// file location: src/components/page-ui/hr/hr-settings-ui.js

export default function HrSettingsPoliciesUi(props) {
  const {
    SettingsContent,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <SettingsContent />; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
