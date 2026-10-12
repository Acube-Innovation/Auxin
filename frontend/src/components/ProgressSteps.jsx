import React from "react";
import "./ProgressSteps.css";

const DEFAULT_STEPS = ["Corporate Details", "Billing Details", "Review Changes"];

// steps: array of labels (["Fixture", "Cargo", ...]) or of { id, label }; ids default to 1..n
function ProgressSteps({ currentStep = 1, onStepClick, steps: stepsProp }) {
  const source = Array.isArray(stepsProp) && stepsProp.length > 0 ? stepsProp : DEFAULT_STEPS;
  const steps = source.map((step, index) =>
    typeof step === "string" ? { id: index + 1, label: step } : { id: step.id ?? index + 1, label: step.label }
  );

  const handleStepClick = (stepId) => {
    if (onStepClick) {
      onStepClick(stepId);
    }
  };

  return (
    <div className="progress-steps">
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <div
            className={`step-label ${currentStep === step.id ? "step-active" : "step-inactive"} ${onStepClick ? "step-clickable" : ""}`}
            onClick={() => handleStepClick(step.id)}
          >
            {step.label}
          </div>
          {index < steps.length - 1 && <div className="step-divider" />}
        </React.Fragment>
      ))}
    </div>
  );
}

export default ProgressSteps;
