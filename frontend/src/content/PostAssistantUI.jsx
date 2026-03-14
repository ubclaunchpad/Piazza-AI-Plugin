import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

// --- Icons ---
export const Icon = ({ children }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export const SimplifyIcon = () => (
  <Icon>
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
  </Icon>
);

export const SummarizeIcon = () => (
  <Icon>
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </Icon>
);

export const SolveIcon = () => (
  <Icon>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </Icon>
);

export const TranslateIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" x2="22" y1="12" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </Icon>
);

export const ConceptIcon = () => (
  <Icon>
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-1 1.5-2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
    <path d="M9 18h6"/>
    <path d="M10 22h4"/>
  </Icon>
);

// --- Components ---

export function ActionButton({ icon, label, onClick, isActive }) {
    const baseClass = "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border cursor-pointer select-none";
    const activeClass = "bg-gradient-to-br from-blue-500 to-blue-700 text-white border-transparent shadow-md transform scale-105";
    const inactiveClass = "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800";

    return (
        <button onClick={onClick} className={`${baseClass} ${isActive ? activeClass : inactiveClass}`}>
            {icon}
            {label}
        </button>
    );
}

export function ResultDisplay({ result }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(result);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative group">
            <button 
                onClick={handleCopy}
                className="absolute top-0 right-0 z-10 p-1.5 text-xs text-gray-400 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 rounded-md transition-all opacity-0 group-hover:opacity-100 border border-gray-200"
                title="Copy to clipboard"
            >
                {copied ? "Copied!" : "Copy"}
            </button>
            <div className="prose prose-sm max-w-none text-gray-800">
            <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex, rehypeRaw]}
                components={{
                    code({node, inline, className, children, ...props}) {
                        const match = /language-(\w+)/.exec(className || '')
                        return !inline && match ? (
                            <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                className="rounded-md text-xs my-2"
                                {...props}
                            >{String(children).replace(/\n$/, '')}</SyntaxHighlighter>
                        ) : (
                            <code className="bg-blue-50 text-blue-600 px-1 py-0.5 rounded text-xs inline-block font-mono" {...props}>
                                {children}
                            </code>
                        )
                    },
                    p: ({ children }) => (
                      <p className="my-2 leading-relaxed text-gray-700">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="my-2 ml-4 list-disc text-gray-700">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="my-2 ml-4 list-decimal text-gray-700">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="my-1">{children}</li>
                    ),
                    h1: ({ children }) => (
                      <h1 className="text-lg font-bold my-3 text-gray-900 border-b pb-1">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-base font-bold my-2 text-gray-800">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-sm font-semibold my-2 text-gray-800">
                        {children}
                      </h3>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-blue-200 pl-4 py-1 my-2 bg-blue-50 rounded-r text-gray-600 italic">
                        {children}
                      </blockquote>
                    ),
                }}
            >
                {result}
            </ReactMarkdown>
            </div>
        </div>
    );
}

export function LoadingSpinner() {
    return (
        <div className="flex items-center gap-3 text-gray-500 py-2">
            <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounceDot" style={{ animationDelay: "0s" }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounceDot" style={{ animationDelay: "0.15s" }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounceDot" style={{ animationDelay: "0.3s" }}></span>
            </div>
            <span>Processing...</span>
        </div>
    );
}

export function ProficiencySelector({ value, onChange }) {
    return (
        <div className="flex items-center gap-2 ml-2 border-l pl-3 border-gray-200">
            <span className="text-xs text-gray-500 font-medium">Level:</span>
            <select 
                value={value} 
                onChange={(e) => onChange(Number(e.target.value))}
                className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-gray-50 text-gray-700 focus:outline-none focus:border-blue-400 cursor-pointer"
            >
                <option value={1}>Beginner</option>
                <option value={2}>Advanced</option>
                <option value={3}>Expert</option>
            </select>
        </div>
    );
}
