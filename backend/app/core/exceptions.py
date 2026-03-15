"""Custom exceptions"""


class WorkflowNotFoundException(Exception):
    """Raised when a workflow is not found"""
    pass


class TemplateNotFoundException(Exception):
    """Raised when a template is not found"""
    pass


class UnauthorizedException(Exception):
    """Raised when user is not authorized"""
    pass


class ValidationException(Exception):
    """Raised when validation fails"""
    pass


class AIServiceException(Exception):
    """Raised when AI service encounters an error"""
    pass


class DatabaseException(Exception):
    """Raised when database operation fails"""
    pass
