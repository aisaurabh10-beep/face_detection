import logging
import sys

def setup_logger():
    """Configures a root logger to output to both console and a file."""
    log_formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(module)s - %(message)s'
    )
    
    # Create a file handler to save logs
    file_handler = logging.FileHandler("attendance_system.log")
    file_handler.setFormatter(log_formatter)
    
    # Create a stream handler to print logs to the console
    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(log_formatter)
    
    # Get the root logger and add handlers
    logger = logging.getLogger()
    logger.setLevel(logging.INFO) # Set the minimum level of logs to capture
    
    # Avoid adding handlers multiple times
    if not logger.handlers:
        logger.addHandler(file_handler)
        logger.addHandler(stdout_handler)
        
    return logger