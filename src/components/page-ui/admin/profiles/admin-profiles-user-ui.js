// file location: src/components/page-ui/admin/profiles/admin-profiles-user-ui.js

export default function AdminProfilePreviewUi(props) {
  const {
    ProfilePage,
    username,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <div style={{
  padding: "16px",
  fontWeight: 600,
  color: "var(--info)"
}}>
        Loading profile…
      </div>; // render extracted page section.

    case "section2":
      return <ProfilePage forcedUserName={username} embeddedOverride adminPreviewOverride />; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
