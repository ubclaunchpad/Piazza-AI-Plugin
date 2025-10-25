import './styles/index.css';

export default function App() {
    
    return (
        <div class="popup-container">
            <header class="popup-header">
                <h1>Piazza AI Plugin</h1>
                <span class="version" id="version">v1.0.0</span>
            </header>

            <div class="main">
                <p class="description">AI-powered enhancements for Piazza</p>

                <button id="testBtn" class="primary-btn">Test Extension</button>
                <div class="status" id="status">Ready</div>
            </div>
        </div>
    )
}