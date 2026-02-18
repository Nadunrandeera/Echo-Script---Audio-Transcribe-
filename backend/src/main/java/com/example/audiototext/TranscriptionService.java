package com.example.audiototext;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TranscriptionService {

    @Value("${app.upload.dir}")
    private String uploadDir;

    @Value("${app.output.dir}")
    private String outputDir;

    @Value("${app.whisper.script}")
    private String whisperScriptPath;

    @Value("${app.python.command}")
    private String pythonCommand;

    @Autowired
    private TranscriptionJobRepository repository;

    private final Map<String, SseEmitter> emitters = new ConcurrentHashMap<>();

    // Inner class to hold job information (for response mapping)
    public static class JobInfo {
        public JobStatus status;
        public String outputFilePath;
        public String message;

        public JobInfo(JobStatus status, String outputFilePath, String message) {
            this.status = status;
            this.outputFilePath = outputFilePath;
            this.message = message;
        }
    }

    public String createJob(String language, String model, String task, User user) {
        String jobId = UUID.randomUUID().toString();
        TranscriptionJob job = TranscriptionJob.builder()
                .id(jobId)
                .status(JobStatus.PENDING)
                .language(language)
                .model(model)
                .task(task)
                .user(user)
                .build();
        repository.save(job);
        return jobId;
    }

    public void updateJobStatus(String jobId, JobStatus status, String message, String outputFilePath) {
        repository.findById(jobId).ifPresent(job -> {
            job.setStatus(status);
            if (message != null)
                job.setMessage(message);
            if (outputFilePath != null)
                job.setOutputFilePath(outputFilePath);

            if (status == JobStatus.COMPLETED || status == JobStatus.FAILED) {
                job.setCompletedAt(LocalDateTime.now());
            }

            repository.save(job);

            // Notify via SSE if an emitter exists
            SseEmitter emitter = emitters.get(jobId);
            if (emitter != null) {
                try {
                    Map<String, Object> data = new HashMap<>();
                    data.put("jobId", jobId);
                    data.put("status", status);
                    data.put("message", job.getMessage());

                    emitter.send(SseEmitter.event()
                            .name("status-update")
                            .data(data));

                    if (status == JobStatus.COMPLETED || status == JobStatus.FAILED) {
                        emitter.complete();
                        emitters.remove(jobId);
                    }
                } catch (IOException e) {
                    emitters.remove(jobId);
                }
            }
        });
    }

    public SseEmitter registerEmitter(String jobId) {
        SseEmitter emitter = new SseEmitter(null); // No timeout for simplicity in dev
        emitters.put(jobId, emitter);

        emitter.onCompletion(() -> emitters.remove(jobId));
        emitter.onTimeout(() -> emitters.remove(jobId));
        emitter.onError((e) -> emitters.remove(jobId));

        return emitter;
    }

    public JobInfo getJobInfo(String jobId) {
        return repository.findById(jobId)
                .map(job -> new JobInfo(job.getStatus(), job.getOutputFilePath(), job.getMessage()))
                .orElse(null);
    }

    public List<TranscriptionJob> getAllJobs(User user) {
        return repository.findAllByUserOrderByCreatedAtDesc(user);
    }

    public String saveAudioFile(MultipartFile file) throws IOException {
        Path uploadPath = Paths.get(uploadDir);
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }

        // Generate a unique filename to avoid collisions
        String originalFilename = file.getOriginalFilename();
        String uniqueFilename = UUID.randomUUID().toString() + "_" + originalFilename;
        Path filePath = uploadPath.resolve(uniqueFilename);

        file.transferTo(filePath.toFile());
        return filePath.toAbsolutePath().toString();
    }

    @Async
    public void processTranscription(String jobId, String inputFilePath, String language, String model, String task) {
        updateJobStatus(jobId, JobStatus.PROCESSING, "Initializing AI transcription engine...", null);

        Path outputPath = Paths.get(outputDir);
        if (!Files.exists(outputPath)) {
            try {
                Files.createDirectories(outputPath);
            } catch (IOException e) {
                updateJobStatus(jobId, JobStatus.FAILED, "Could not create output directory", null);
                return;
            }
        }

        try {
            // Build the command list dynamically based on parameters
            java.util.List<String> command = new java.util.ArrayList<>();
            command.add(pythonCommand);
            command.add(whisperScriptPath);
            command.add(inputFilePath);
            command.add(outputPath.toAbsolutePath().toString()); // Pass output directory
            command.add(jobId); // Pass job ID as base filename

            // Add optional parameters if provided
            if (model != null && !model.isEmpty()) {
                command.add("--model");
                command.add(model);
            }

            if (language != null && !language.isEmpty() && !"auto".equalsIgnoreCase(language)) {
                command.add("--language");
                command.add(language);
            }

            if (task != null && !task.isEmpty()) {
                command.add("--task");
                command.add(task);
            }

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectErrorStream(true); // Merge stderr into stdout
            Process process = pb.start();

            updateJobStatus(jobId, JobStatus.PROCESSING, "AI Model loading... (This may take a minute)", null);

            // Read output from the process (logging purposes)
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                boolean processingStarted = false;
                while ((line = reader.readLine()) != null) {
                    System.out.println("[Whisper-" + jobId + "]: " + line);

                    // Update UI status based on whisper output if possible
                    if (!processingStarted && line.toLowerCase().contains("detecting language")) {
                        updateJobStatus(jobId, JobStatus.PROCESSING, "Analyzing audio and detecting language...", null);
                        processingStarted = true;
                    } else if (line.toLowerCase().contains("transcribing")) {
                        updateJobStatus(jobId, JobStatus.PROCESSING, "Audio analysis complete. Transcribing...", null);
                    }
                }
            }

            int exitCode = process.waitFor();
            if (exitCode == 0) {
                updateJobStatus(jobId, JobStatus.COMPLETED, "Success! Transcription finalized.",
                        outputPath.resolve(jobId + ".txt").toAbsolutePath().toString());
            } else {
                updateJobStatus(jobId, JobStatus.FAILED, "Process encountered an error (Code: " + exitCode + ")", null);
            }

        } catch (Exception e) {
            e.printStackTrace();
            updateJobStatus(jobId, JobStatus.FAILED, "System Exception: " + e.getMessage(), null);
        }
    }
}
