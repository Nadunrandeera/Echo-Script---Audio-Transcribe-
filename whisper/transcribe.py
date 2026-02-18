import argparse
import whisper
import os
import sys
import yt_dlp
from whisper.utils import get_writer

def download_audio(url, output_dir, job_id):
    print(f"Downloading audio from: {url}...")
    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': os.path.join(output_dir, f'{job_id}_temp_audio.%(ext)s'),
        'quiet': True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
    
    audio_path = os.path.join(output_dir, f'{job_id}_temp_audio.mp3')
    return audio_path

def transcribe_audio(input_source, output_dir, job_id, model_name="small", language=None, task="transcribe"):
    audio_path = input_source
    is_url = input_source.startswith("http://") or input_source.startswith("https://")
    
    if is_url:
        try:
            audio_path = download_audio(input_source, output_dir, job_id)
        except Exception as e:
            print(f"Error downloading audio: {e}")
            sys.exit(1)

    print(f"Loading Whisper model: {model_name}...")
    try:
        model = whisper.load_model(model_name)
    except Exception as e:
        print(f"Error loading model: {e}")
        sys.exit(1)

    print(f"Processing audio: {audio_path}...")
    if not os.path.exists(audio_path):
        print(f"Error: Audio file not found: {audio_path}")
        sys.exit(1)

    try:
        # Transcribe
        result = model.transcribe(audio_path, language=language, task=task)
        
        # 1. Save Plain Text
        text_path = os.path.abspath(os.path.join(output_dir, f"{job_id}.txt"))
        with open(text_path, "w", encoding="utf-8") as f:
            f.write(result["text"].strip())
        print(f"Saved text to: {text_path}")
            
        # 2. Save Timestamped Text (for UI display)
        timestamped_text_path = os.path.abspath(os.path.join(output_dir, f"{job_id}_timestamped.txt"))
        with open(timestamped_text_path, "w", encoding="utf-8") as f:
            for segment in result["segments"]:
                start = int(segment['start'])
                m, s = divmod(start, 60)
                h, m = divmod(m, 60)
                timestamp = f"[{h:02d}:{m:02d}:{s:02d}]"
                f.write(f"{timestamp} {segment['text'].strip()}\n")
        print(f"Saved timestamped text to: {timestamped_text_path}")

        # 3. Save SRT and VTT using Whisper utilities
        # Whisper 2024+ writers expect: writer(result, audio_path_or_id, options)
        options = {"highlight_words": False, "max_line_count": None, "max_line_width": None}
        for fmt in ["srt", "vtt"]:
            writer = get_writer(fmt, output_dir)
            writer(result, job_id, options)
            print(f"Saved {fmt.upper()} to: {os.path.join(output_dir, job_id)}.{fmt}")

        # Cleanup temp audio if downloaded from URL
        if is_url and os.path.exists(audio_path):
            os.remove(audio_path)

        print("Transcription complete.")
        print(f"Files saved to {output_dir}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error during transcription: {e}")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Transcribe audio or URL to text using Whisper.")
    parser.add_argument("input_source", help="Path to input audio file or URL")
    parser.add_argument("output_dir", help="Directory to save output files")
    parser.add_argument("job_id", help="Base name for output files (Job ID)")
    parser.add_argument("--model", default="small", help="Whisper model name")
    parser.add_argument("--language", default=None, help="Language code")
    parser.add_argument("--task", default="transcribe", help="Task (transcribe or translate)")

    args = parser.parse_args()

    transcribe_audio(args.input_source, args.output_dir, args.job_id, args.model, args.language, args.task)
