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

export function useAuth() {
  return {
    user: {
      id: 1,
      email: "rehaan@test.com",
      firstName: "Rehaan",
    },
    isLoading: false,
    isAuthenticated: true,
  };
}
