// ============================================
// 日记内容客户端加密 — AES-256-GCM + PBKDF2
// ============================================

const ALGORITHM = "AES-GCM" as const;
const KEY_LENGTH = 256;
const SALT_PREFIX = "时光轴::";

/** 从 sessionStorage 存取加密密钥 */
const KEY_STORE_KEY = "_timeline_enc_key";

function loadKeyFromStore(): CryptoKey | null {
  try {
    const raw = sessionStorage.getItem(KEY_STORE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CryptoKey | null;
  } catch {
    return null;
  }
}

function saveKeyToStore(key: CryptoKey | null): void {
  if (key) {
    // CryptoKey 不能直接序列化，存到用户 session 级的 global cache 中
    // 用 sessionStorage 标记表示"已派生过密钥"
    sessionStorage.setItem(KEY_STORE_KEY, "1");
  } else {
    sessionStorage.removeItem(KEY_STORE_KEY);
  }
}

// 内存缓存（同标签页内复用）
let _cachedKey: CryptoKey | null = null;

function setKey(key: CryptoKey | null) {
  _cachedKey = key;
  saveKeyToStore(key);
}

/**
 * 从邮箱 + 密码派生 AES-256-GCM 加密密钥
 */
export async function deriveKey(
  email: string,
  password: string
): Promise<CryptoKey> {
  const salt = new TextEncoder().encode(SALT_PREFIX + email.trim().toLowerCase());
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 200_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
  setKey(key);
  return key;
}

/**
 * 获取当前加密密钥。如果内存中不可用且不提供凭据，返回 null。
 * 注意：CryptoKey 无法序列化存储，浏览器重启后会丢失，
 * 此时需用户重新登录以重新派生密钥。
 */
export async function getKey(
  email?: string,
  password?: string
): Promise<CryptoKey | null> {
  if (_cachedKey) return _cachedKey;

  // sessionStorage 说密钥存在但内存中没有 → 浏览器重启过，清除过期标记
  if (sessionStorage.getItem(KEY_STORE_KEY) === "1") {
    sessionStorage.removeItem(KEY_STORE_KEY);
  }

  if (email && password) {
    return deriveKey(email, password);
  }

  return null;
}

/** 登出时清除密钥 */
export function clearKey(): void {
  _cachedKey = null;
  saveKeyToStore(null);
}

/**
 * 加密文本
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  );
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

/**
 * 解密文本
 */
export async function decrypt(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  try {
    const encryptedBytes = Uint8Array.from(atob(ciphertext), (c) =>
      c.charCodeAt(0)
    );
    const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: ivBytes },
      key,
      encryptedBytes
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    // 解密失败返回空
    return "";
  }
}
