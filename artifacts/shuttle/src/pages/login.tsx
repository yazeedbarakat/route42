import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

type UserRole = "student" | "admin" | "driver";

export default function Login() {
  const { user, setToken } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("student");

  const loginMutation = useLogin();
  const registerMutation = useRegister();

  useEffect(() => {
    if (user) {
      if (user.role === "student") setLocation("/dashboard");
      else if (user.role === "admin") setLocation("/admin");
      else if (user.role === "driver") setLocation("/driver");
    }
  }, [user, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isRegistering) {
        const res = await registerMutation.mutateAsync({
          data: { email, password, name, role }
        });
        setToken(res.token);
        toast({ title: "SYSTEM", description: "REGISTRATION_SUCCESSFUL" });
      } else {
        const res = await loginMutation.mutateAsync({
          data: { email, password }
        });
        setToken(res.token);
        toast({ title: "SYSTEM", description: "AUTHENTICATION_SUCCESSFUL" });
      }
    } catch (err: any) {
      toast({ 
        title: "ERR_AUTH_FAILED", 
        description: err?.message || "ACCESS_DENIED",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="mb-8 text-center">
          <pre className="text-primary text-xs sm:text-sm md:text-base leading-tight inline-block text-left">
{`   _____ __  __   __    ____  ______ 
  / ___// / / /  / /   / __ \\/ ____/ 
  \\__ \\/ /_/ /  / /   / / / / / __   
 ___/ / __  /  / /___/ /_/ / /_/ /   
/____/_/ /_/  /_____/\\____/\\____/    `}
          </pre>
          <div className="mt-4 text-xl tracking-widest font-bold">SMART SHUTTLE SOLUTION</div>
          <div className="text-muted-foreground text-sm mt-2">v1.0.0_beta</div>
        </div>

        <div className="border border-border bg-card p-6 shadow-xl relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
          
          <h2 className="text-xl mb-6 flex items-center gap-2">
            <span className="text-primary">{">"}</span> 
            {isRegistering ? "INIT_NEW_USER" : "LOGIN_REQUIRED"}
            <span className="blink">_</span>
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">{"[NAME]"}</label>
                <input 
                  type="text" 
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-background border border-border p-2 focus:border-primary focus:outline-none transition-colors"
                  placeholder="Enter full name"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">{"[EMAIL]"}</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-background border border-border p-2 focus:border-primary focus:outline-none transition-colors"
                placeholder="user@42irbid.edu"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">{"[PASSWORD]"}</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-background border border-border p-2 focus:border-primary focus:outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>

            {isRegistering && (
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">{"[ROLE]"}</label>
                <select 
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full bg-background border border-border p-2 focus:border-primary focus:outline-none transition-colors text-foreground"
                >
                  <option value="student">STUDENT</option>
                  <option value="admin">ADMIN</option>
                  <option value="driver">DRIVER</option>
                </select>
              </div>
            )}

            <div className="pt-4">
              <button 
                type="submit" 
                className="w-full bg-primary text-primary-foreground font-bold p-3 border border-primary hover:bg-transparent hover:text-primary transition-colors disabled:opacity-50"
                disabled={loginMutation.isPending || registerMutation.isPending}
              >
                {isRegistering ? "EXECUTE_REGISTER" : "EXECUTE_LOGIN"}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-sm">
            <button 
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
            >
              {isRegistering ? "SWITCH_TO_LOGIN" : "SWITCH_TO_REGISTER"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
