package com.example.audiototext;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class TranscriptionController {

    @Autowired
    private TranscriptionService transcriptionService;

    @PostMapping("/transcribe")
    public ResponseEntity<?> uploadAndTranscribe(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "language", required = false) String language,
            @RequestParam(value = "model", defaultValue = "small") String model,
            @RequestParam(value = "task", defaultValue = "transcribe") String task) {

        System.out.println(">>> Received request to /api/transcribe");

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("Please select a file to upload");
        }

        try {
            // 1. Get current user
            Object principal = org.springframework.security.core.context.SecurityContextHolder.getContext()
                    .getAuthentication().getPrincipal();

            if (!(principal instanceof User)) {
                System.out.println(
                        ">>> Unauthorized transcription request. Principal type: " + principal.getClass().getName());
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("User session expired or not authenticated");
            }

            User user = (User) principal;
            System.out.println(">>> Starting transcription job for user: " + user.getUsername());

            // 2. Create a job
            String jobId = transcriptionService.createJob(language, model, task, user);

            // 3. Save file
            String filePath = transcriptionService.saveAudioFile(file);

            // 4. Start async process
            transcriptionService.processTranscription(jobId, filePath, language, model, task);

            // 5. Return jobId
            Map<String, String> response = new HashMap<>();
            response.put("jobId", jobId);
            response.put("status", "PENDING");

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println(">>> Transcription Job Error: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to start processing: " + e.getMessage());
        }
    }

    @PostMapping("/transcribe-link")
    public ResponseEntity<?> transcribeFromLink(
            @RequestParam("url") String url,
            @RequestParam(value = "language", required = false) String language,
            @RequestParam(value = "model", defaultValue = "small") String model,
            @RequestParam(value = "task", defaultValue = "transcribe") String task) {

        System.out.println(">>> Received request to /api/transcribe-link: " + url);

        if (url == null || url.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("URL cannot be empty");
        }

        try {
            // 1. Get current user
            Object principal = org.springframework.security.core.context.SecurityContextHolder.getContext()
                    .getAuthentication().getPrincipal();

            if (!(principal instanceof User)) {
                System.out.println(
                        ">>> Unauthorized transcription request. Principal type: " + principal.getClass().getName());
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("User session expired or not authenticated");
            }

            User user = (User) principal;
            System.out.println(">>> Starting link transcription job for user: " + user.getUsername());

            // 2. Create a job
            String jobId = transcriptionService.createJob(language, model, task, user);

            // 3. Start async process (pass the URL instead of file path)
            transcriptionService.processTranscription(jobId, url, language, model, task);

            // 4. Return jobId
            Map<String, String> response = new HashMap<>();
            response.put("jobId", jobId);
            response.put("status", "PENDING");

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println(">>> Link Transcription Job Error: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to start processing: " + e.getMessage());
        }
    }

    @GetMapping("/status/events/{jobId}")
    public SseEmitter streamStatus(@PathVariable String jobId) {
        return transcriptionService.registerEmitter(jobId);
    }

    @GetMapping("/status/{jobId}")
    public ResponseEntity<?> getStatus(@PathVariable String jobId) {
        TranscriptionService.JobInfo info = transcriptionService.getJobInfo(jobId);
        if (info == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Job not found");
        }

        Map<String, Object> response = new HashMap<>();
        response.put("jobId", jobId);
        response.put("status", info.status);
        response.put("message", info.message);

        if (info.status == JobStatus.COMPLETED && info.outputFilePath != null) {
            try {
                System.out.println("[Status-" + jobId + "]: Reading result from " + info.outputFilePath);
                // Return timestamped version for the UI if it exists
                Path timestampedPath = Paths.get(info.outputFilePath.replace(".txt", "_timestamped.txt"));
                if (Files.exists(timestampedPath)) {
                    System.out.println("[Status-" + jobId + "]: Found timestamped version");
                    response.put("transcript", Files.readString(timestampedPath));
                } else {
                    System.out.println(
                            "[Status-" + jobId + "]: Timestamped version NOT found, falling back to plain text");
                    response.put("transcript", Files.readString(Paths.get(info.outputFilePath)));
                }
            } catch (IOException e) {
                System.err.println("[Status-" + jobId + "]: Error reading file: " + e.getMessage());
                response.put("transcript", "Error reading result file: " + e.getMessage());
            }
        }

        return ResponseEntity.ok(response);
    }

    @GetMapping("/download/{jobId}")
    public ResponseEntity<Resource> downloadResult(
            @PathVariable String jobId,
            @RequestParam(value = "format", defaultValue = "txt") String format) {

        TranscriptionService.JobInfo info = transcriptionService.getJobInfo(jobId);
        if (info == null || info.status != JobStatus.COMPLETED || info.outputFilePath == null) {
            return ResponseEntity.notFound().build();
        }

        String extension = format.toLowerCase();
        if (!extension.equals("txt") && !extension.equals("srt") && !extension.equals("vtt")) {
            extension = "txt";
        }

        Path path = Paths.get(info.outputFilePath.replace(".txt", "." + extension));
        Resource resource = new FileSystemResource(path.toFile());

        if (!resource.exists()) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_PLAIN)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"transcript_" + jobId + "." + extension + "\"")
                .body(resource);
    }

    @GetMapping("/history")
    public ResponseEntity<?> getHistory() {
        User user = (User) org.springframework.security.core.context.SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return ResponseEntity.ok(transcriptionService.getAllJobs(user));
    }
}
