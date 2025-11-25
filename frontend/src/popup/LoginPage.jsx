import { useState } from "react";

export default function LoginPage({ onLogin, onSignup }) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Basic validation
    if (!email || !password) {
      setError("Please fill in all fields");
      setIsLoading(false);
      return;
    }

    if (isSignup && !name) {
      setError("Please enter your name");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setIsLoading(false);
      return;
    }

    try {
      const result = isSignup
        ? await onSignup(email, password, name)
        : await onLogin(email, password);

      if (!result.success) {
        setError(result.error || "Authentication failed");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignup(!isSignup);
    setError("");
    setEmail("");
    setPassword("");
    setName("");
  };

  return (
    <div className="flex flex-col min-h-[500px] p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="text-4xl leading-none">🧠</div>
          <h1 className="text-2xl font-bold text-gray-900 bg-gradient-to-r from-purple-500 to-purple-700 bg-clip-text text-transparent">
            ThreadSense AI
          </h1>
        </div>
        <p className="text-sm text-gray-600">AI-powered Piazza assistant</p>
      </div>

      {/* Form */}
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {isSignup && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              disabled={isLoading}
              className="px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm transition-all focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 disabled:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            disabled={isLoading}
            className="px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm transition-all focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 disabled:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-sm font-medium text-gray-700"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            disabled={isLoading}
            className="px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm transition-all focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 disabled:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        {error && (
          <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="mt-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-lg text-sm font-semibold cursor-pointer transition-all shadow-md shadow-purple-200 hover:from-purple-600 hover:to-purple-800 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-300 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-md"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              {isSignup ? "Signing up..." : "Logging in..."}
            </span>
          ) : (
            <span>{isSignup ? "Sign Up" : "Log In"}</span>
          )}
        </button>

        <div className="text-center text-sm text-gray-600 mt-2 flex items-center justify-center gap-1.5">
          <span>
            {isSignup ? "Already have an account?" : "Don't have an account?"}
          </span>
          <button
            type="button"
            className="text-purple-600 font-semibold underline hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={toggleMode}
            disabled={isLoading}
          >
            {isSignup ? "Log in" : "Sign up"}
          </button>
        </div>
      </form>
    </div>
  );
}
