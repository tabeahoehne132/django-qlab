"""
QLab settings configuration.

Allows users to customize QLab behavior via Django settings.
"""

from django.conf import settings


# Default settings
QLAB_DEFAULTS = {
    'DEFAULT_APP_LABEL': 'core',
    'PAGE_SIZE': 100,
    'MAX_RELATION_DEPTH': 2,
}


class QLABSettings:
    """
    Settings handler for QLab configuration.
    
    Allows users to override defaults via QLAB_SETTINGS in Django settings.
    
    Example in settings.py:
        QLAB_SETTINGS = {
            'DEFAULT_APP_LABEL': 'myapp',
            'PAGE_SIZE': 50,
        }
    """
    
    def __init__(self):
        # Get user settings from Django settings
        user_settings = getattr(settings, 'QLAB_SETTINGS', {})
        
        # Merge with defaults
        self.settings = {**QLAB_DEFAULTS, **user_settings}
    
    def __getattr__(self, name):
        """Allow attribute-style access to settings."""
        if name in self.settings:
            return self.settings[name]
        raise AttributeError(f"'{self.__class__.__name__}' has no attribute '{name}'")
    
    def get(self, key, default=None):
        """Dictionary-style access to settings."""
        return self.settings.get(key, default)


qlab_settings = QLABSettings()