// From javascript_log_in_with_replit integration
// import { useQuery } from "@tanstack/react-query";
// import type { User } from "@shared/schema";

// export function useAuth() {
//   const { data: user, isLoading } = useQuery<User>({
//     queryKey: ["/api/auth/user"],
//     retry: false,
//   });

//   return {
//     user,
//     isLoading,
//     isAuthenticated: !!user,
//   };
// }

import { useQuery } from "@tanstack/react-query";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const res = await fetch("/api/auth/user", {
        credentials: "include",
      });
      if (res.status === 401 || res.status === 403) return null;
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
  };
}
