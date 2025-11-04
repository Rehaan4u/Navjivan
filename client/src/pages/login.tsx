import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import profilePhoto from "@assets/Gajanan Pujari Profile Photo (2)_1762282581387.jpeg";

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <Card className="w-full max-w-md p-8 shadow-xl">
        <div className="space-y-6 text-center">
          <div className="flex justify-center">
            <div className="relative">
              <img
                src={profilePhoto}
                alt="Gajanan Pujari"
                className="w-24 h-24 rounded-full object-cover ring-4 ring-primary/10"
                data-testid="img-profile-photo"
              />
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <i className="fas fa-newspaper text-white text-sm"></i>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Welcome to Payment Chronicle</h1>
            <p className="text-muted-foreground">
              Created by <span className="font-semibold text-foreground">Gajanan Pujari</span>
            </p>
          </div>

          <div className="space-y-3 pt-4">
            <p className="text-sm text-muted-foreground">
              Daily payments industry intelligence delivered to your inbox at 9:00 AM IST
            </p>
          </div>

          <div className="pt-6 space-y-4">
            <Button
              size="lg"
              className="w-full"
              onClick={() => window.location.href = '/api/login'}
              data-testid="button-login-gmail"
            >
              <i className="fab fa-google mr-2"></i>
              Continue with Gmail
            </Button>

            <p className="text-xs text-muted-foreground">
              Sign in to track payments companies and receive AI-powered news summaries
            </p>
          </div>

          <div className="pt-6 border-t">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="font-semibold text-primary">AI-Powered</div>
                <div className="text-xs text-muted-foreground">GPT-5 Summaries</div>
              </div>
              <div>
                <div className="font-semibold text-primary">3 Companies</div>
                <div className="text-xs text-muted-foreground">Track Maximum</div>
              </div>
              <div>
                <div className="font-semibold text-primary">Daily</div>
                <div className="text-xs text-muted-foreground">9:00 AM IST</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="absolute bottom-8 text-center w-full px-4">
        <p className="text-sm text-muted-foreground">
          &copy; 2025 Payment Chronicle by Gajanan Pujari. All rights reserved.
        </p>
      </div>
    </div>
  );
}
