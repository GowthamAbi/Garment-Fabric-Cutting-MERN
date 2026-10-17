import UGSaaSLoader from "./UGSaaSLoader.jsx";
// Shared inline loader used by smaller panels while data is unavailable.
export default function Loader({ text = "Loading...", size = "compact" }) {
  return <UGSaaSLoader size={size} surface="transparent" message={text} />;
}
