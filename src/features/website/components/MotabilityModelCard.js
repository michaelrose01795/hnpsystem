// file location: src/features/website/components/MotabilityModelCard.js
//
// One Motability vehicle: photo, brand, model name, powertrain, automatic
// availability and the advance payment. Data shape is siteContent.motability
// .models (src/features/website/data/siteContent.js).
//
// A model with no image shows its brand name in the photo slot, so a new model
// can be listed before its photography arrives.
//
// Styling: custglobal.css @family marketing (.ws-model-*).

/* eslint-disable @next/next/no-img-element */

export default function MotabilityModelCard({ model }) {
  if (!model?.model) return null;
  const name = [model.brand, model.model].filter(Boolean).join(" ");
  return (
    <article className="ws-card ws-model-card">
      <div className="ws-model-media">
        {model.image ? (
          <img src={model.image} alt={name} loading="lazy" />
        ) : (
          <span className="ws-model-media-fallback" aria-hidden="true">
            {model.brand}
          </span>
        )}
      </div>
      <div className="ws-card-body ws-model-body">
        {model.brand ? <span className="ws-vehicle-brand">{model.brand}</span> : null}
        <h3 className="ws-card-title">{model.model}</h3>
        {model.powertrain || model.automatic ? (
          <ul className="ws-model-specs" aria-label={`${name} specification`}>
            {model.powertrain ? <li className="ws-model-spec">{model.powertrain}</li> : null}
            {model.automatic ? <li className="ws-model-spec">{model.automatic}</li> : null}
          </ul>
        ) : null}
        {model.advancePayment ? (
          <p className="ws-model-price">
            <span className="ws-model-price-label">Advance payment</span>
            <span className="ws-model-price-value">{model.advancePayment}</span>
          </p>
        ) : null}
      </div>
    </article>
  );
}
