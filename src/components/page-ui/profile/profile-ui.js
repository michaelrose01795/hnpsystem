// file location: src/components/page-ui/profile/profile-ui.js

export default function ProfilePageWrapperUi(uiProps) {
  const {
    ProfilePage,
    props,
  } = uiProps; // receive page logic props.

  switch (uiProps.view) { // choose the page section requested by logic.
    case "section1":
      return <ProfilePage {...props} />; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
