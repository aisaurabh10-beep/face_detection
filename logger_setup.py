# src/logger_setup.py
import logging
from logging.handlers import RotatingFileHandler
import os
import sys

def setup_logger(log_file=None, level="INFO"):
    fmt = "%(asctime)s %(levelname)s %(name)s: %(message)s"
    lvl = getattr(logging, level.upper(), logging.INFO)
    root = logging.getLogger()
    # clear handlers to avoid duplicates
    if root.handlers:
        root.handlers.clear()
    root.setLevel(lvl)

    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(name)s:%(lineno)d - %(message)s'))
    ch.setLevel(lvl)
    root.addHandler(ch)

    if log_file:
        os.makedirs(os.path.dirname(log_file), exist_ok=True)
        fh = RotatingFileHandler(log_file, maxBytes=10*1024*1024, backupCount=5)
        fh.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(name)s:%(lineno)d - %(message)s'))
        fh.setLevel(lvl)
        root.addHandler(fh)

        # formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(name)s:%(lineno)d - %(message)s')
