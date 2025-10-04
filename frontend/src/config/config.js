// Environment Configuration for Chrome Extension
// This file loads environment variables for the extension

class Config {
  constructor() {
    // Default configuration
    this.config = {
      API_BASE_URL: "http://localhost:8000",
      VERSION: "1.0.0",
      NODE_ENV: "development",
    };

    // Load environment-specific config
    this.loadEnvironmentConfig();
  }

  loadEnvironmentConfig() {
    // In a Chrome extension, we can't use process.env directly
    // Instead, we'll use a build process or inject these at build time

    // For development, you can manually set these values
    // or use a build tool like webpack to inject them

    if (typeof EXTENSION_ENV !== "undefined") {
      // This would be injected by a build process
      Object.assign(this.config, EXTENSION_ENV);
    }
  }

  get(key) {
    return this.config[key];
  }

  getApiUrl(endpoint = "") {
    const baseUrl = this.get("API_BASE_URL");
    return endpoint ? `${baseUrl}/${endpoint.replace(/^\//, "")}` : baseUrl;
  }

  isProduction() {
    return this.get("NODE_ENV") === "production";
  }

  isDevelopment() {
    return this.get("NODE_ENV") === "development";
  }
}

// Export singleton instance
const config = new Config();

// Make it available globally in the extension
if (typeof window !== "undefined") {
  window.ExtensionConfig = config;
}

// For module systems
if (typeof module !== "undefined" && module.exports) {
  module.exports = config;
}
