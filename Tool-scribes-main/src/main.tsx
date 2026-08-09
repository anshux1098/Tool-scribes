import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import { isSupabaseConfigured, supabaseInitError } from "./lib/supabase";
import "./index.css";

function SetupScreen() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6">
      <div className="max-w-lg w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-tv-primary/10 mb-6">
          <span className="text-3xl">🔧</span>
        </div>
        <h1 className="font-syne text-[36px] text-tv-text leading-tight mb-3">
          Tool<em className="not-italic text-tv-primary">Scribe</em>
        </h1>
        <p className="text-[14px] text-tv-text-s mb-2 leading-relaxed">
          Supabase is not configured.
        </p>
        <div className="bg-surface border border-tv-border rounded-xl p-5 text-left font-mono text-[13px] space-y-3 mb-6">
          <p className="text-red-600 font-medium">{supabaseInitError}</p>
          <p className="text-tv-text-s">
            This app requires a Supabase project to run. To set it up:
          </p>
          <ol className="text-tv-text-s list-decimal list-inside space-y-1.5 leading-relaxed">
            <li>Create a project at <span className="text-tv-primary">supabase.com</span></li>
            <li>Go to <strong>Settings → API</strong> in your project dashboard</li>
            <li>Copy the <strong>Project URL</strong> and <strong>publishable key</strong> (or anon key)</li>
            <li>
              Create a <code className="bg-s2 px-1.5 py-0.5 rounded text-tv-text">.env</code> file in the project root:
            </li>
          </ol>
          <pre className="bg-s2 p-3 rounded-lg text-tv-text text-[12px] leading-relaxed overflow-x-auto">
VITE_SUPABASE_URL=https://your-project.supabase.co{"\n"}
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
          </pre>
          <p className="text-tv-text-s">
            A template is available in <code className="bg-s2 px-1.5 py-0.5 rounded text-tv-text">.env.example</code>
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 bg-tv-primary text-white text-[13px] font-medium rounded-lg hover:bg-tv-primary-dark transition-colors"
        >
          Retry after configuring
        </button>
      </div>
    </div>
  );
}

const helmetContext = {};

createRoot(document.getElementById("root")!).render(
  <HelmetProvider context={helmetContext}>
    {isSupabaseConfigured ? <App /> : <SetupScreen />}
  </HelmetProvider>
);
