import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { API_BASE_URL, DEMO_MODE } from "@/lib/runtime-config";
import { dispatch } from "@/demo/handlers";

const apiBase = API_BASE_URL;
const normalizedApiBase = apiBase.replace(/\/+$/, "").endsWith("/api")
  ? apiBase.replace(/\/+$/, "")
  : `${apiBase.replace(/\/+$/, "")}/api`;

async function readJson(res: Response) {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function safeNextAuthResponse(request: Request, context: any) {
  const response = await nextAuthHandler(request, context);
  const pathname = new URL(request.url).pathname;

  if (!pathname.endsWith("/api/auth/session")) return response;

  if (response.status === 204 || response.status === 205 || response.body === null) {
    return Response.json(null, { status: 200 });
  }

  const text = await response.clone().text().catch(() => "");
  if (!text.trim()) return Response.json(null, { status: 200 });

  return response;
}

const providers: NextAuthOptions["providers"] = [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "admin@email.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (DEMO_MODE) {
          // Mode demo: login langsung ke data in-memory (tanpa backend).
          try {
            const data: any = await dispatch('POST', '/auth/login', new URLSearchParams(), null, new Request('http://demo.local/auth/login', { method: 'POST', body: JSON.stringify(credentials), headers: { 'content-type': 'application/json' } }));
            return { id: String(data.user.sub), name: data.user.name, email: data.user.email, role_id: data.user.role_id, role: data.user.role, avatar_url: data.user.avatar_url, accessToken: data.access_token } as any;
          } catch { return null; }
        }
        const res = await fetch(`${normalizedApiBase}/auth/login`, {
          method: 'POST',
          body: JSON.stringify(credentials),
          headers: { "Content-Type": "application/json" }
        });
        
        const data = await readJson(res);

        // Jika response dari NestJS sukses dan mengembalikan token
        if (res.ok && data?.access_token) {
          return {
            id: data.user.sub.toString(),
            name: data.user.name,
            email: data.user.email,
            role_id: data.user.role_id,
            role: data.user.role,
            avatar_url: data.user.avatar_url,
            accessToken: data.access_token
          };
        }
        
        // Jika gagal (email/password salah), kembalikan null
        return null;
      }
    })
];

if (!DEMO_MODE && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.unshift(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid email profile",
          prompt: "select_account",
        },
      },
    }),
  );
}

const authOptions: NextAuthOptions = {
  providers,
  callbacks: {
    // Menyalin data dari hasil authorize ke dalam token JWT milik NextAuth
    async jwt({ token, user, account, trigger, session }) {
      if (account?.provider === "google" && account.id_token) {
        const res = await fetch(`${normalizedApiBase}/auth/google`, {
          method: "POST",
          body: JSON.stringify({ idToken: account.id_token }),
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });

        const data = await readJson(res);
        if (!res.ok || !data?.access_token) {
          throw new Error(data?.message ?? "Google login gagal diproses backend");
        }

        token.sub = data.user.sub.toString();
        token.name = data.user.name;
        token.email = data.user.email;
        token.picture = data.user.avatar_url ?? token.picture;
        token.role_id = data.user.role_id;
        token.role = data.user.role;
        token.avatar_url = data.user.avatar_url;
        token.accessToken = data.access_token;
      } else if (user) {
        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role_id = user.role_id;
        token.role = user.role;
        token.avatar_url = user.avatar_url;
        token.accessToken = user.accessToken;
      }
      if (trigger === "update" && session?.user) {
        token.name = session.user.name ?? token.name;
        token.avatar_url = session.user.avatar_url ?? token.avatar_url;
        token.picture = session.user.image ?? token.picture;
      }
      return token;
    },
    // Menyalin data dari token JWT ke object Session agar bisa dibaca di halaman React
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role_id = token.role_id as number;
        session.user.role = token.role as string;
        session.user.avatar_url = (token.avatar_url as string | null) ?? null;
        session.user.image = (token.avatar_url as string | null) ?? token.picture ?? null;
        session.accessToken = token.accessToken as string;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login', // Nanti kita buat halaman antarmuka login di app/login/page.tsx
    error: '/login',
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const nextAuthHandler = NextAuth(authOptions);
export { safeNextAuthResponse as GET, nextAuthHandler as POST };
