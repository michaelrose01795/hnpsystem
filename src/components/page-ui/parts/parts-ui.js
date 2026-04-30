// file location: src/components/page-ui/parts/parts-ui.js

export default function PartsRedirectUi(props) {
  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <div style={{
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100vh',
  fontSize: '1.2rem',
  color: 'var(--text-1)'
}}>
      Redirecting to Stock Catalogue...
    </div>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
