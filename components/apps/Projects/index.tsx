import { type ComponentProcessProps } from "components/system/Apps/RenderComponent";

const Projects: FC<ComponentProcessProps> = () => (
  <iframe
    height="100%"
    src="/projects/index.html"
    style={{ background: "#f7f6f3", border: 0, display: "block" }}
    title="Vanshika's project collection"
    width="100%"
  />
);

export default Projects;
