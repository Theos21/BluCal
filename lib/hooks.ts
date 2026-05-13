import { useAuth } from './AuthContext';

export const useCurrentUser = () => {
  const { user, profile } = useAuth();
  return { user, profile };
};
