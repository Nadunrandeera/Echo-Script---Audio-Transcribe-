package com.example.audiototext;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TranscriptionJobRepository extends JpaRepository<TranscriptionJob, String> {
    List<TranscriptionJob> findAllByOrderByCreatedAtDesc();

    List<TranscriptionJob> findAllByUserOrderByCreatedAtDesc(User user);
}
