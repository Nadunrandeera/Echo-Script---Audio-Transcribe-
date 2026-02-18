package com.example.audiototext;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "transcription_jobs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TranscriptionJob {

    @Id
    private String id;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Enumerated(EnumType.STRING)
    private JobStatus status;

    private String inputFilePath;
    private String outputFilePath;
    private String message;

    private String language;
    private String model;
    private String task;

    private LocalDateTime createdAt;
    private LocalDateTime completedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
