// file location: src/features/website/shop/ShopServiceInfo.js
//
// Delivery, click & collect, genuine parts and help — the questions people ask
// before they buy a part, answered next to the parts. Copy is code-owned in
// data/partsContent.js (`serviceInfo`); empty that list and the strip goes.
//
// Styling: .ws-shop-info-* in custglobal.css (@family shop).

import { partsContent } from "../data/partsContent";

export default function ShopServiceInfo({ items = partsContent.serviceInfo }) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return null;
  return (
    <ul className="ws-shop-info" aria-label="Delivery, collection and help">
      {list.map((item) => (
        <li key={item.id} className="ws-shop-info-item">
          <span className="ws-shop-info-title">{item.title}</span>
          {item.body ? <p className="ws-muted">{item.body}</p> : null}
          {item.link?.href ? (
            <a href={item.link.href} className="ws-catalog-phone">
              {item.link.label}
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
