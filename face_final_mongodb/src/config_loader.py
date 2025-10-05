import configparser

def load_config(path='config.ini'):
    """Reads and parses the configuration file."""
    config = configparser.ConfigParser()
    config.read(path)
    return config