import { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DashboardTab from './components/DashboardTab';
import UnderwriteTab from './components/UnderwriteTab';
import AnalysisTab from './components/AnalysisTab';
import HistoryTab from './components/HistoryTab';
import ChatBot from './components/ChatBot';
import PrintShell from './components/PrintShell';
import { warmUpServer } from './api';

const PAGE_TITLES = {
  dashboard:  'Underwriting Dashboard',
  underwrite: 'New Credit Assessment',
  analysis:   'Financial Health Analysis',
  history:    'Assessment Case History',
};
const PAGE_SUBTITLES = {
  dashboard:  'Real-time credit risk evaluation and default probability assessment.',
  underwrite: 'Submit applicant data through the wizard to generate a risk score.',
  analysis:   'Leverage ratios, cash flow analysis, and financial stability indicators.',
  history:    'Search, review, and manage all past credit risk evaluations.',
};

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [theme, setTheme] = useState('dark');
  const [predictionResults, setPredictionResults] = useState(null);
  const [activeApplicant, setActiveApplicant] = useState(null);

  // Pre-warm the Render backend on page load so the cold-start doesn't hit the user mid-form
  useEffect(() => { warmUpServer(); }, []);

  const switchTab = useCallback((tabId) => setCurrentTab(tabId), []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  const handlePredictionResult = useCallback((inputs, data) => {
    setActiveApplicant(inputs);
    setPredictionResults(data);
    setCurrentTab('dashboard');
  }, []);

  return (
    <div className="app-container">
      <Sidebar
        currentTab={currentTab}
        switchTab={switchTab}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <main className="main-content">
        {/* Content Header */}
        <header className="content-header">
          <div className="header-title-container">
            <h1 id="page-title">{PAGE_TITLES[currentTab]}</h1>
            <p id="page-subtitle">{PAGE_SUBTITLES[currentTab]}</p>
          </div>
          <div className="header-actions">
            {activeApplicant && (
              <div id="current-applicant-badge" className="applicant-badge" style={{ display: 'inline-flex' }}>
                <span id="active-applicant-name">{activeApplicant.name}</span>
              </div>
            )}
          </div>
        </header>

        {/* Tab Content */}
        <div className="tab-content">
          <section className={`tab-pane${currentTab === 'dashboard' ? ' active' : ''}`} id="tab-dashboard">
            <DashboardTab results={predictionResults} applicant={activeApplicant} theme={theme} />
          </section>

          <section className={`tab-pane${currentTab === 'underwrite' ? ' active' : ''}`} id="tab-underwrite">
            <UnderwriteTab onPredictionResult={handlePredictionResult} />
          </section>

          <section className={`tab-pane${currentTab === 'analysis' ? ' active' : ''}`} id="tab-analysis">
            <AnalysisTab results={predictionResults} applicant={activeApplicant} theme={theme} isActive={currentTab === 'analysis'} />
          </section>

          <section className={`tab-pane${currentTab === 'history' ? ' active' : ''}`} id="tab-history">
            <HistoryTab isActive={currentTab === 'history'} />
          </section>
        </div>
      </main>

      <ChatBot results={predictionResults} applicant={activeApplicant} />
      <PrintShell results={predictionResults} applicant={activeApplicant} />
    </div>
  );
}
