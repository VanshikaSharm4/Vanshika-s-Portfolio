import { useEffect, useId, useRef, useState } from "react";
import styled from "styled-components";

const Overlay = styled.div`
  background: #242526;
  color: #fff;
  font-size: 13px;
  font-weight: 400;
  height: 100%;
  inset: 0;
  padding: 8px 12px;
  position: absolute;
  text-shadow: none;
  z-index: 10;

  form {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  input {
    background: #fff;
    color: #111;
    flex: 1;
    min-width: 100px;
    padding: 5px;
  }

  button {
    background: #444;
    color: #fff;
    cursor: pointer;
    padding: 5px 10px;
  }

  p {
    color: #ffb4b4;
    margin-top: 4px;
  }
`;

type ProfileInputProps = {
  error: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
  secret?: boolean;
  title: string;
  value: string;
};

const ProfileInput: FC<ProfileInputProps> = ({
  error,
  onCancel,
  onSubmit,
  secret,
  title,
  value,
}) => {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <Overlay
      aria-label={title}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") onCancel();
      }}
      role="dialog"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(text);
        }}
      >
        <label htmlFor={inputId}>{title}</label>
        <input
          ref={inputRef}
          autoComplete="off"
          id={inputId}
          onChange={(event) => setText(event.target.value)}
          type={secret ? "password" : "text"}
          value={text}
        />
        <button type="submit">Save</button>
        <button onClick={onCancel} type="button">
          Cancel
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </Overlay>
  );
};

export default ProfileInput;
