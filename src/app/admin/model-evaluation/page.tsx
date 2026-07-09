import Link from "next/link";

const metrics = [
  {
    label: "Training labels",
    value: "symptom_checkins",
    detail: "Self-reported outcomes linked to a saved health snapshot.",
  },
  {
    label: "Predictor table",
    value: "ml_feature_snapshots",
    detail: "A Supabase view joining local signals with optional outcomes.",
  },
  {
    label: "Validation split",
    value: "stratified holdout",
    detail: "Model selection happens before final test-set evaluation.",
  },
  {
    label: "Current claim",
    value: "experimental",
    detail: "Not a diagnosis or clinically validated illness prediction.",
  },
];

const validationChecks = [
  "ROC AUC, average precision, balanced accuracy, precision, recall, F1, and Brier score",
  "Confusion matrix and class-balance reporting",
  "Feature importance export for leakage and proxy-variable review",
  "Calibration review before using the word probability in user-facing copy",
  "Prospective validation after enough real check-ins are collected",
];

export default function ModelEvaluationPage() {
  return (
    <main className="min-h-screen bg-[#f5f9fc] px-6 py-8 text-[#102a43]">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 border-b border-[#d7e5f0] pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#2f74b5]">
              Model Evaluation
            </p>
            <h1 className="mt-2 font-heading text-4xl font-semibold">
              Validation status and ML pipeline
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#58708a]">
              This page summarizes how MyLocalHealth turns search-time features
              and optional check-ins into an auditable training pipeline.
            </p>
          </div>
          <Link
            className="rounded-full bg-[#153e75] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#102a43]"
            href="/"
          >
            Back to app
          </Link>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          {metrics.map((metric) => (
            <article
              className="rounded-3xl border border-[#d7e5f0] bg-white p-5 shadow-[0_16px_45px_-35px_rgba(16,42,67,0.55)]"
              key={metric.label}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-[#637d98]">
                {metric.label}
              </p>
              <h2 className="mt-3 text-xl font-bold text-[#102a43]">
                {metric.value}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#58708a]">
                {metric.detail}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <article className="rounded-3xl border border-[#d7e5f0] bg-white p-6 shadow-[0_16px_45px_-35px_rgba(16,42,67,0.55)]">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2f74b5]">
              Statistical Guardrails
            </p>
            <h2 className="mt-2 font-heading text-3xl font-semibold">
              What makes the model respectable
            </h2>
            <ul className="mt-5 grid gap-3">
              {validationChecks.map((check) => (
                <li
                  className="rounded-2xl border border-[#d7e5f0] bg-[#f5f9fc] p-4 text-sm leading-6 text-[#334e68]"
                  key={check}
                >
                  {check}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-3xl border border-[#d7e5f0] bg-[#153e75] p-6 text-white shadow-[0_16px_45px_-35px_rgba(16,42,67,0.55)]">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#cfe8f9]">
              Demo Language
            </p>
            <h2 className="mt-2 font-heading text-3xl font-semibold">
              Say this clearly
            </h2>
            <p className="mt-5 text-sm leading-7 text-[#d9eaf7]">
              MyLocalHealth currently uses an explainable public-health risk
              index. The ML layer is designed to learn from future check-ins,
              but the current symptom signal is experimental and should not be
              described as a clinical prediction.
            </p>
            <div className="mt-5 rounded-2xl border border-white/20 bg-white/10 p-4 text-sm leading-6">
              Pipeline scripts: <code>ml/train_symptom_model.py</code>,{" "}
              <code>ml/generate_model_report.py</code>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
