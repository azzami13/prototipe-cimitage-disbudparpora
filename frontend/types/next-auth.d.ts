import NextAuth from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  // Memperluas tipe User bawaan NextAuth
  interface User {
    id: string;
    role_id: number;
    role: string;
    avatar_url?: string | null;
    accessToken: string;
  }
  
  // Memperluas tipe Session bawaan NextAuth
  interface Session {
    user: User;
    accessToken: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role_id: number;
    role: string;
    avatar_url?: string | null;
    accessToken: string;
  }
}
