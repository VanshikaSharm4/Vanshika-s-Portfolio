import { renderToStaticMarkup } from "react-dom/server";
import {
  SessionProvider,
  useSortOrder,
  useView,
  useWindowState,
} from "contexts/session";
import useSessionContextState from "contexts/session/useSessionContextState";

jest.mock<{ default: typeof useSessionContextState }>(
  "contexts/session/useSessionContextState",
  () => ({
    __esModule: true,
    default: jest.fn(),
  })
);

const DIRECTORY = "/Users/Public/Start Menu";
const Probe = (): React.JSX.Element => {
  const view = useView(DIRECTORY);
  const sortOrder = useSortOrder(DIRECTORY);
  const windowState = useWindowState("FileExplorer");

  return <span>{JSON.stringify({ sortOrder, view, windowState })}</span>;
};

const readProbe = (markup: string): unknown => {
  const container = document.createElement("div");

  container.innerHTML = markup;

  return JSON.parse(container.textContent || "{}");
};

describe("session directory selectors", () => {
  it("returns safe defaults while the session store is uninitialised", () => {
    expect(readProbe(renderToStaticMarkup(<Probe />))).toStrictEqual({
      sortOrder: [],
      windowState: {},
    });
  });

  it("preserves restored directory and window settings", () => {
    jest.mocked(useSessionContextState).mockReturnValue({
      actions: {} as ReturnType<typeof useSessionContextState>["actions"],
      state: {
        sortOrders: { [DIRECTORY]: [["Messenger.url"], "name", true] },
        views: { [DIRECTORY]: "details" },
        windowStates: { FileExplorer: { maximized: true } },
      } as unknown as ReturnType<typeof useSessionContextState>["state"],
    });

    expect(
      readProbe(
        renderToStaticMarkup(
          <SessionProvider>
            <Probe />
          </SessionProvider>
        )
      )
    ).toStrictEqual({
      sortOrder: [["Messenger.url"], "name", true],
      view: "details",
      windowState: { maximized: true },
    });
  });
});
