import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

import { db } from '@/lib/server/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        nickname: { label: '닉네임', type: 'text' },
        password: { label: '비밀번호', type: 'password' },
      },
      authorize: async (credentials) => {
        const nickname = credentials?.nickname;
        const password = credentials?.password;
        if (typeof nickname !== 'string' || typeof password !== 'string') {
          return null;
        }

        const user = await db.user.findUnique({ where: { nickname } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.nickname };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.userId) session.user.id = token.userId;
      return session;
    },
  },
});
