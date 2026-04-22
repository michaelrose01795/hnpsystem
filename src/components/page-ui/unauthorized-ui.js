// file location: src/components/page-ui/unauthorized-ui.js

export default function UnauthorizedPageUi(props) {
  const {
    Link,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <div style={{
  padding: 24,
  maxWidth: 720,
  margin: '40px auto'
}}>
      <h1>Unauthorized</h1>
      <p>You do not have permission to view that page.</p>
      <p>
        <Link href="/dashboard">Back to dashboard</Link>
      </p>
    </div>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
