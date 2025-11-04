import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Subscription, Newsletter, Article } from "@shared/schema";

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [companies, setCompanies] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [user, authLoading, toast]);

  // Fetch subscription
  const { data: subscription, isLoading: subscriptionLoading } = useQuery<Subscription>({
    queryKey: ["/api/subscriptions"],
    enabled: !!user,
  });

  // Fetch newsletters
  const { data: newsletters = [], isLoading: newslettersLoading } = useQuery<Newsletter[]>({
    queryKey: ["/api/newsletters"],
    enabled: !!user,
  });

  // Update companies input when subscription loads
  useEffect(() => {
    if (subscription) {
      setCompanies(subscription.companies);
    }
  }, [subscription]);

  // Subscribe/Update mutation
  const subscribeMutation = useMutation({
    mutationFn: async (data: { companies: string }) => {
      const method = subscription ? "PUT" : "POST";
      return await apiRequest(method, "/api/subscriptions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      toast({
        title: "Success",
        description: subscription 
          ? "Your subscription has been updated" 
          : "You're all set! Your first newsletter will arrive tomorrow at 9:00 AM IST",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update subscription",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate companies input
    const companiesList = companies
      .split(/[,;]/)
      .map(c => c.trim())
      .filter(c => c.length > 0);

    if (companiesList.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please enter at least one company name",
        variant: "destructive",
      });
      return;
    }

    if (companiesList.length > 3) {
      toast({
        title: "Validation Error",
        description: "You can track a maximum of 3 companies",
        variant: "destructive",
      });
      return;
    }

    subscribeMutation.mutate({ companies: companiesList.join(", ") });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <i className="fas fa-newspaper text-2xl text-primary"></i>
              <h1 className="text-xl font-bold">Payment Chronicle</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                {user?.profileImageUrl ? (
                  <img 
                    src={user.profileImageUrl} 
                    alt={user.firstName || "User"} 
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <i className="fas fa-user text-primary text-sm"></i>
                  </div>
                )}
                <span className="text-sm font-medium hidden sm:inline">
                  {user?.firstName || user?.email}
                </span>
              </div>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/api/logout'}
                data-testid="button-logout"
              >
                <i className="fas fa-sign-out-alt mr-2"></i>
                Log Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <div className="space-y-12">
          {/* Welcome Section */}
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">
              Welcome back, {user?.firstName || 'there'}!
            </h2>
            <p className="text-muted-foreground">
              Manage your newsletter preferences and view your archive
            </p>
          </div>

          {/* Subscription Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className="fas fa-building text-primary"></i>
                Company Preferences
              </CardTitle>
              <CardDescription>
                Select up to 3 payments industry companies you want to track
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="companies">Company Names</Label>
                  <Input
                    id="companies"
                    type="text"
                    placeholder="Visa, PayPal, Discover Financial Services"
                    value={companies}
                    onChange={(e) => setCompanies(e.target.value)}
                    disabled={subscribeMutation.isPending}
                    data-testid="input-companies"
                  />
                  <p className="text-sm text-muted-foreground">
                    <i className="fas fa-info-circle mr-1"></i>
                    Separate company names with commas or semicolons (maximum 3)
                  </p>
                </div>

                {subscription && (
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <p className="text-sm font-medium mb-2">
                      <i className="fas fa-check-circle text-primary mr-2"></i>
                      Active Subscription
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Your next newsletter will be delivered tomorrow at 9:00 AM IST
                    </p>
                  </div>
                )}

                <Button 
                  type="submit" 
                  disabled={subscribeMutation.isPending || !companies.trim()}
                  data-testid="button-subscribe"
                >
                  {subscribeMutation.isPending ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      {subscription ? "Updating..." : "Subscribing..."}
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save mr-2"></i>
                      {subscription ? "Update Preferences" : "Start My Newsletter"}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Newsletter Archive */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold">Newsletter Archive</h3>
                <p className="text-muted-foreground">
                  View and download your past newsletters
                </p>
              </div>
              <Badge variant="secondary">
                {newsletters.length} newsletter{newsletters.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            {newslettersLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-6">
                    <div className="space-y-3">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : newsletters.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto">
                    <i className="fas fa-inbox text-3xl text-muted-foreground"></i>
                  </div>
                  <h4 className="text-xl font-semibold">No Newsletters Yet</h4>
                  <p className="text-muted-foreground">
                    {subscription 
                      ? "Your first newsletter will arrive tomorrow at 9:00 AM IST" 
                      : "Subscribe to companies above to start receiving newsletters"}
                  </p>
                </div>
              </Card>
            ) : (
              <div className="grid gap-4">
                {newsletters.map((newsletter) => (
                  <NewsletterCard key={newsletter.id} newsletter={newsletter} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function NewsletterCard({ newsletter }: { newsletter: Newsletter }) {
  const [expanded, setExpanded] = useState(false);
  const { data: articles = [] } = useQuery<Article[]>({
    queryKey: ["/api/newsletters", newsletter.id, "articles"],
    enabled: expanded,
  });

  const date = new Date(newsletter.generatedAt!);
  const formattedDate = date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <Card className="hover-elevate">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h4 className="text-lg font-semibold">{formattedDate}</h4>
              {newsletter.emailSent && (
                <Badge variant="secondary" className="text-xs">
                  <i className="fas fa-check mr-1"></i>
                  Sent
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {newsletter.companies.split(',').map((company, index) => (
                <Badge key={index} variant="outline">
                  {company.trim()}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            {newsletter.pdfPath && (
              <Button 
                size="sm" 
                variant="outline"
                data-testid={`button-download-${newsletter.id}`}
              >
                <i className="fas fa-download mr-2"></i>
                PDF
              </Button>
            )}
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => setExpanded(!expanded)}
              data-testid={`button-toggle-${newsletter.id}`}
            >
              <i className={`fas fa-chevron-${expanded ? 'up' : 'down'}`}></i>
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
            {articles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Loading articles...
              </p>
            ) : (
              articles.map((article) => (
                <div key={article.id} className="space-y-2">
                  <h5 className="font-serif font-semibold text-base">
                    {article.headline}
                  </h5>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {article.summary}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-medium">{article.sourceName}</span>
                    <span>&bull;</span>
                    <a 
                      href={article.sourceUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-primary"
                    >
                      Read more <i className="fas fa-external-link-alt ml-1"></i>
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
