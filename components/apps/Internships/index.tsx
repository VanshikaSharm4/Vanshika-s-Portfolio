import { type ComponentProcessProps } from "components/system/Apps/RenderComponent";

const Internships: FC<ComponentProcessProps> = () => (
  <iframe
    height="100%"
    src="/internships/index.html"
    style={{ background: "#f8f6f2", border: 0, display: "block" }}
    title="Vanshika's internships — Adobe and ARGUS AI"
    width="100%"
  />
);

export default Internships;
