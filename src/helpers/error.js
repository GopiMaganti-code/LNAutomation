/**
 * TestError Class
 * Custom error class for test operations with descriptive messages
 */

class TestError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = "TestError";
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Creates a TestError with context about the operation that failed
   * @param {string} operation - The operation that failed
   * @param {string} details - Additional details about the failure
   * @param {Object} context - Additional context object
   * @returns {TestError}
   */
  static create(operation, details, context = {}) {
    const message = `TestError: ${operation} - ${details}`;
    return new TestError(message, { operation, details, ...context });
  }
}

module.exports = { TestError };
