import { Metadata } from "nostr-tools/kinds";
import { useState } from "react";
import {
  BASE_RW_RELAYS,
  UNKNOWN_PUBLIC_KEY,
  USE_EXTENSION_IDB_NAME,
} from "components/apps/Messenger/constants";
import {
  copyKeyMenuItems,
  createProfileEvent,
  dataToProfile,
  descCreatedAt,
  getSigner,
  getWebSocketStatusIcon,
  importSecretKey,
} from "components/apps/Messenger/functions";
import { useHistoryContext } from "components/apps/Messenger/HistoryContext";
import { useNostrProfile } from "components/apps/Messenger/hooks";
import { Back, Write } from "components/apps/Messenger/Icons";
import { useNostr } from "components/apps/Messenger/NostrContext";
import Profile, { PROFILE } from "components/apps/Messenger/Profile";
import ProfileInput from "components/apps/Messenger/ProfileInput";
import StyledProfileBanner from "components/apps/Messenger/StyledProfileBanner";
import { type ProfileData, type Signer } from "components/apps/Messenger/types";
import { useMenu, useMenuActions } from "contexts/menu";
import Button from "styles/common/Button";
import { MENU_SEPERATOR } from "utils/constants";
import { haltEvent, toSorted } from "utils/functions";

const GRADIENT = "linear-gradient(rgba(0, 0, 0, 0.10), rgba(0, 0, 0, 0.5))";
const STYLING =
  "center center / cover no-repeat local border-box border-box #000";

type ProfileBannerProps = {
  block: (key: string) => void;
  deleteChat: (key: string) => void;
  goBack?: () => void;
  hideReadMessages: boolean;
  newChat: () => void;
  selectedRecipientKey: string;
  setHideReadMessages: React.Dispatch<React.SetStateAction<boolean>>;
  setSigner: (signer: Signer) => void;
};

const ProfileBanner: FC<ProfileBannerProps> = ({
  block,
  deleteChat,
  goBack,
  hideReadMessages,
  newChat,
  selectedRecipientKey,
  setHideReadMessages,
  setSigner,
}) => {
  const [profileInput, setProfileInput] = useState<{
    secret?: boolean;
    submit: (value: string) => void;
    title: string;
    value: string;
  }>();
  const [inputError, setInputError] = useState("");
  const { connectToRelay, publish, query, relayStatus, signer } = useNostr();
  const { publicKey, secretKey } = signer;
  const isOwnProfile = !selectedRecipientKey;
  const pubkey =
    selectedRecipientKey === UNKNOWN_PUBLIC_KEY
      ? ""
      : selectedRecipientKey || publicKey;
  const {
    banner,
    data,
    nip05,
    picture,
    userName = "New message",
  } = useNostrProfile(pubkey);
  const style = banner
    ? { background: `${GRADIENT}, url(${banner}) ${STYLING}` }
    : {};
  const { contextMenu } = useMenuActions();
  const { label: openMenu } = useMenu();
  const { blockedKeys, setBlockedKeys, setProfiles } = useHistoryContext();
  const updateProfile = async (
    newProfile: Partial<ProfileData>
  ): Promise<void> => {
    if (Object.values(newProfile).filter(Boolean).length === 0) return;

    try {
      // Merge onto the latest published profile so no fields are lost
      const [latest] = toSorted(
        await query({ authors: [publicKey], kinds: [Metadata] }),
        descCreatedAt
      );
      let profile = data;

      if (latest) profile = JSON.parse(latest.content) as ProfileData;

      const content = { ...profile, ...newProfile };
      const event = await createProfileEvent(signer, content);

      publish(event);
      setProfiles((currentProfiles) => ({
        ...currentProfiles,
        [publicKey]: dataToProfile(publicKey, content, event.created_at),
      }));
    } catch {
      // Ignore errors publishing profile data
    }
  };
  const switchSigner = (useExtension: boolean): void => {
    if (useExtension) {
      localStorage.setItem(USE_EXTENSION_IDB_NAME, "true");
    } else {
      localStorage.removeItem(USE_EXTENSION_IDB_NAME);
    }

    getSigner().then(setSigner);
  };
  const { onContextMenuCapture } = contextMenu(() => {
    if (!pubkey) return [];
    if (!isOwnProfile) {
      return [
        ...copyKeyMenuItems(pubkey),
        MENU_SEPERATOR,
        { action: () => deleteChat(pubkey), label: "Delete Chat" },
        { action: () => block(pubkey), label: "Block" },
      ];
    }

    return [
      ...copyKeyMenuItems(pubkey, secretKey),
      MENU_SEPERATOR,
      {
        action: () => {
          setInputError("");
          setProfileInput({
            submit: (name) => {
              if (name.trim()) {
                updateProfile({ display_name: name.trim(), name: name.trim() });
              }
              setProfileInput(undefined);
            },
            title: "Edit Username",
            value: userName,
          });
        },
        label: "Edit Username",
      },
      MENU_SEPERATOR,
      {
        action: () => {
          setInputError("");
          setProfileInput({
            submit: (value) => {
              updateProfile({ picture: value });
              setProfileInput(undefined);
            },
            title: "Picture URL",
            value: picture || "",
          });
        },
        label: "Edit Picture",
      },
      {
        action: () => {
          setInputError("");
          setProfileInput({
            submit: (value) => {
              updateProfile({ banner: value });
              setProfileInput(undefined);
            },
            title: "Banner URL",
            value: banner || "",
          });
        },
        label: "Edit Banner",
      },
      MENU_SEPERATOR,
      {
        action: () => setHideReadMessages(!hideReadMessages),
        label: `${hideReadMessages ? "Show" : "Hide"} Read Messages`,
      },
      ...(blockedKeys.length > 0
        ? [
            {
              action: () => setBlockedKeys([]),
              label: `Unblock All (${blockedKeys.length})`,
            },
          ]
        : []),
      MENU_SEPERATOR,
      ...(secretKey
        ? [
            ...(window.nostr
              ? [
                  {
                    action: () => {
                      if (window.nostr?.nip44) switchSigner(true);
                      else {
                        setInputError(
                          "This extension doesn't support NIP-44 encryption, which private messages need."
                        );
                      }
                    },
                    label: "Sign In with Extension",
                  },
                ]
              : []),
            {
              action: () => {
                setInputError("");
                setProfileInput({
                  secret: true,
                  submit: (key) => {
                    const newSigner = importSecretKey(key);
                    if (newSigner) {
                      setProfileInput(undefined);
                      setSigner(newSigner);
                    } else setInputError("That isn't a valid nsec.");
                  },
                  title: "Use Existing Key",
                  value: "",
                });
              },
              label: "Use Existing Key...",
            },
          ]
        : [{ action: () => switchSigner(false), label: "Sign Out" }]),
    ];
  }, PROFILE);

  return (
    <StyledProfileBanner onContextMenuCapture={haltEvent} style={style}>
      {profileInput && (
        <ProfileInput
          key={profileInput.title}
          error={inputError}
          onCancel={() => {
            setProfileInput(undefined);
            setInputError("");
          }}
          onSubmit={profileInput.submit}
          secret={profileInput.secret}
          title={profileInput.title}
          value={profileInput.value}
        />
      )}
      {!profileInput && inputError && <span role="alert">{inputError}</span>}
      <Button
        aria-label={goBack ? "Back" : "New message"}
        onClick={goBack || newChat}
      >
        {goBack ? <Back /> : <Write />}
      </Button>
      {isOwnProfile && (
        <div className="relays">
          <ol>
            {toSorted(BASE_RW_RELAYS).map((relayUrl) => (
              <li key={relayUrl}>
                <button
                  // aria-disabled keeps the tooltip and connected status
                  // reachable, unlike a natively disabled button
                  aria-disabled={relayStatus[relayUrl] ? true : undefined}
                  aria-label={`${relayUrl} (${
                    relayStatus[relayUrl] || "disconnected"
                  })`}
                  onClick={
                    relayStatus[relayUrl]
                      ? undefined
                      : () => connectToRelay(relayUrl)
                  }
                  title={relayUrl}
                  type="button"
                >
                  {getWebSocketStatusIcon(relayStatus[relayUrl])}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
      <Profile
        expanded={openMenu === PROFILE}
        nip05={nip05}
        onClick={onContextMenuCapture}
        picture={picture}
        pubkey={pubkey}
        userName={userName}
      />
    </StyledProfileBanner>
  );
};

export default ProfileBanner;
