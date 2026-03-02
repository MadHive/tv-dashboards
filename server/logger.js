// Simple logger stub that wraps console methods
const logger = {
  debug: (...args) => {
    // Skip debug logs in production
    if (process.env.NODE_ENV !== 'production') {
      console.log(...args);
    }
  },

  info: (...args) => {
    console.log(...args);
  },

  warn: (...args) => {
    console.warn(...args);
  },

  error: (...args) => {
    console.error(...args);
  }
};

export default logger;
