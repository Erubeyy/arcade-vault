/* eslint-disable @next/next/no-img-element -- los avatares vienen de dominios externos del proveedor OAuth */
export function UserBadge({
  username,
  avatarUrl,
  className,
}: {
  username: string;
  avatarUrl: string | null;
  className?: string;
}) {
  return (
    <span className={"user-badge" + (className ? " " + className : "")}>
      {avatarUrl ? (
        <img
          className="avatar"
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="avatar" aria-hidden="true">
          {username.charAt(0)}
        </span>
      )}
      <span className="uname">{username}</span>
    </span>
  );
}
