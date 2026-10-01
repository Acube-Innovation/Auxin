import React from "react";
import "./ProgressSteps.css";

function ProgressSteps({ currentStep = 1, onStepClick }) {
  const steps = [
    { id: 1, label: "Corporate Details" },
    { id: 2, label: "Billing Details" },
    { id: 3, label: "Review Changes" },
  ];

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
