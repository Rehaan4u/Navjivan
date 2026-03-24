import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Subscription, Newsletter, Article } from "@shared/schema";
import { X } from "lucide-react";

const VALID_COMPANIES = [
  { name: "Visa", logo: "https://logo.clearbit.com/visa.com" },
  { name: "PayPal", logo: "https://logo.clearbit.com/paypal.com" },
  { name: "Discover", logo: "https://logo.clearbit.com/discover.com" },
] as const;

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  // Company multi-select state
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [companySearch, setCompanySearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch subscription
  const { data: subscription, isLoading: subscriptionLoading } = useQuery<Subscription | null>({
    queryKey: ["/api/subscriptions"],
    enabled: !!user,
    retry: false,
    queryFn: async () => {
      try {
        const response = await fetch("/api/subscriptions", { credentials: "include" });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error("Failed to fetch subscription");
        return response.json();
      } catch (error) {
        if (error instanceof Error && error.message.includes("404")) return null;
        throw error;
      }
    },
  });

  // Fetch newsletters
  const { data: newsletters = [], isLoading: newslettersLoading } = useQuery<Newsletter[]>({
    queryKey: ["/api/newsletters"],
    enabled: !!user,
  });

  // Sync selected companies when subscription loads
  useEffect(() => {
    if (subscription) {
      const list = subscription.companies.split(',').map(c => c.trim()).filter(Boolean);
      setSelectedCompanies(list);
    }
  }, [subscription]);

  // Filtered companies for dropdown
  const filteredCompanies = VALID_COMPANIES.filter(
    c =>
      c.name.toLowerCase().includes(companySearch.toLowerCase()) &&
      !selectedCompanies.includes(c.name)
  );

  const searchMatchesNothing = companySearch.length > 0 && filteredCompanies.length === 0;

  const removeCompany = (name: string) => {
    setSelectedCompanies(prev => prev.filter(c => c !== name));
    setCompanyError(null);
  };

  // Subscribe/Update mutation
  const subscribeMutation = useMutation({
    mutationFn: async (data: { companies: string }) => {
      const method = subscription ? "PUT" : "POST";
      const response = await apiRequest(method, "/api/subscriptions", data);
      return await response.json() as Subscription;
    },
    onSuccess: (data: Subscription) => {
      queryClient.setQueryData(["/api/subscriptions"], data);
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
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: error.message || "Failed to update subscription", variant: "destructive" });
    },
  });

  // Manual newsletter generation mutation
  const triggerNewsletterMutation = useMutation({
    mutationFn: async () => {
      console.log("Fetch firing");
      const response = await fetch("/api/admin/trigger-newsletters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        credentials: "include",
      });
      console.log("Response:", response.status);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status}: ${text}`);
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletters"] });
      toast({
        title: "Newsletter Generating!",
        description: `Newsletter is being generated in the background. Check your email at ${user?.email} in a few minutes.`,
      });
    },
    onError: (error: Error) => {
      console.error("Newsletter generation request failed:", error.message);
      toast({ title: "Generation Failed", description: error.message || "Failed to generate newsletter", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // If user typed something that doesn't match any company, block saving
    if (companySearch.length > 0) {
      const match = VALID_COMPANIES.find(c => c.name.toLowerCase() === companySearch.toLowerCase());
      if (!match) {
        setCompanyError("Invalid company — please select from the list");
        return;
      }
    }

    if (selectedCompanies.length === 0) {
      toast({ title: "Validation Error", description: "Please select at least one company", variant: "destructive" });
      return;
    }

    subscribeMutation.mutate({ companies: selectedCompanies.join(", ") });
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
                  <img src={user.profileImageUrl} alt={user.firstName || "User"} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <i className="fas fa-user text-primary text-sm"></i>
                  </div>
                )}
                <span className="text-sm font-medium hidden sm:inline" data-testid="text-username">
                  {user?.firstName || user?.email}
                </span>
              </div>
              <Button variant="outline" onClick={() => window.location.href = '/api/logout'} data-testid="button-logout">
                <i className="fas fa-sign-out-alt mr-2"></i>
                Log Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="space-y-2 mb-8">
          <h2 className="text-3xl font-bold">Welcome back, {user?.firstName || 'there'}!</h2>
          <p className="text-muted-foreground">Manage your newsletter preferences and view your archive</p>
        </div>

        <Tabs defaultValue="home">
          <TabsList className="mb-8">
            <TabsTrigger value="home" data-testid="tab-home">Home</TabsTrigger>
            <TabsTrigger value="archive" data-testid="tab-archive">Newsletter Archive</TabsTrigger>
          </TabsList>

          {/* HOME TAB */}
          <TabsContent value="home" className="space-y-8">
            {/* Company Preferences */}
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
                    <Label>Companies</Label>

                    {/* Multi-select dropdown */}
                    <div className="relative" ref={dropdownRef}>
                      {/* Input box with chips */}
                      <div
                        className={`flex flex-wrap gap-1.5 p-2 border rounded-md min-h-10 items-center cursor-text bg-background ${companyError || searchMatchesNothing ? "border-red-500" : "border-input"}`}
                        onClick={() => {
                          setDropdownOpen(true);
                        }}
                        data-testid="input-companies"
                      >
                        {selectedCompanies.map(name => {
                          const company = VALID_COMPANIES.find(c => c.name === name);
                          return (
                            <span
                              key={name}
                              className="flex items-center gap-1 bg-secondary text-secondary-foreground rounded-md px-2 py-0.5 text-sm"
                              data-testid={`chip-company-${name}`}
                            >
                              {company && (
                                <img
                                  src={company.logo}
                                  alt={name}
                                  className="w-4 h-4 rounded-sm object-contain"
                                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                              )}
                              {name}
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); removeCompany(name); }}
                                className="ml-0.5 text-muted-foreground hover:text-foreground"
                                data-testid={`button-remove-${name}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}
                        <input
                          type="text"
                          value={companySearch}
                          onChange={e => {
                            setCompanySearch(e.target.value);
                            setDropdownOpen(true);
                            setCompanyError(null);
                          }}
                          onFocus={() => setDropdownOpen(true)}
                          placeholder={selectedCompanies.length === 0 ? "Search companies..." : ""}
                          className="flex-1 min-w-24 outline-none bg-transparent text-sm py-0.5"
                          disabled={selectedCompanies.length >= 3 || subscribeMutation.isPending}
                          data-testid="input-company-search"
                        />
                      </div>

                      {/* Dropdown list */}
                      {dropdownOpen && filteredCompanies.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 border rounded-md bg-background shadow-md z-20 overflow-hidden">
                          {filteredCompanies.map(company => (
                            <button
                              type="button"
                              key={company.name}
                              className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-left hover-elevate"
                              onMouseDown={e => {
                                e.preventDefault();
                                setSelectedCompanies(prev => [...prev, company.name]);
                                setCompanySearch("");
                                setDropdownOpen(false);
                                setCompanyError(null);
                              }}
                              data-testid={`option-company-${company.name}`}
                            >
                              <img
                                src={company.logo}
                                alt={company.name}
                                className="w-5 h-5 rounded-sm object-contain"
                                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                              {company.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Error message */}
                      {(companyError || searchMatchesNothing) && (
                        <p className="text-sm text-red-500 mt-1" data-testid="text-company-error">
                          Invalid company — please select from the list
                        </p>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground">
                      <i className="fas fa-info-circle mr-1"></i>
                      Choose from Visa, PayPal, or Discover (maximum 3)
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
                    disabled={subscribeMutation.isPending || selectedCompanies.length === 0}
                    data-testid="button-save-subscription"
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

            {/* Manual Newsletter Generation */}
            {subscription && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <i className="fas fa-bolt text-primary"></i>
                    Generate Newsletter Now
                  </CardTitle>
                  <CardDescription>
                    Immediately generate and send your newsletter instead of waiting for tomorrow's scheduled delivery
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                      <p className="text-sm font-medium">
                        <i className="fas fa-info-circle text-primary mr-2"></i>
                        What happens when you click this button:
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                        <li>• Scrapes latest news from premium industry sources</li>
                        <li>• AI analyzes and scores articles for relevance</li>
                        <li>• Generates Finshots-style summaries</li>
                        <li>• Creates professional PDF newsletter</li>
                        <li>• Sends email to {user?.email}</li>
                      </ul>
                    </div>
                    <Button
                      onClick={() => {
                        console.log("Button clicked");
                        triggerNewsletterMutation.mutate();
                      }}
                      disabled={triggerNewsletterMutation.isPending}
                      size="lg"
                      data-testid="button-trigger-newsletter"
                    >
                      {triggerNewsletterMutation.isPending ? (
                        <>
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                          Sending Request...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-rocket mr-2"></i>
                          Generate & Send Newsletter Now
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* NEWSLETTER ARCHIVE TAB */}
          <TabsContent value="archive">
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-2xl font-bold">Newsletter Archive</h3>
                  <p className="text-muted-foreground">View and download your past newsletters</p>
                </div>
                <Badge variant="secondary">
                  {newsletters.length} newsletter{newsletters.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              {newslettersLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
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
                        : "Subscribe to companies on the Home tab to start receiving newsletters"}
                    </p>
                  </div>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {newsletters.map(newsletter => (
                    <NewsletterCard key={newsletter.id} newsletter={newsletter} />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
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
    day: 'numeric',
  });

  return (
    <Card className="hover-elevate">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h4 className="text-lg font-semibold">{formattedDate}</h4>
              {newsletter.emailSent && (
                <Badge variant="secondary" className="text-xs">
                  <i className="fas fa-check mr-1"></i>
                  Sent
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {newsletter.companies.split(',').map((company, index) => {
                const match = VALID_COMPANIES.find(c => c.name.toLowerCase() === company.trim().toLowerCase());
                return (
                  <Badge key={index} variant="outline" className="flex items-center gap-1">
                    {match && (
                      <img
                        src={match.logo}
                        alt={match.name}
                        className="w-3.5 h-3.5 rounded-sm object-contain"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                    {company.trim()}
                  </Badge>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2">
            {newsletter.pdfPath && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => newsletter.pdfPath && window.open(newsletter.pdfPath, '_blank')}
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
              <p className="text-sm text-muted-foreground text-center py-4">Loading articles...</p>
            ) : (
              articles.map(article => (
                <div key={article.id} className="space-y-2">
                  <h5 className="font-serif font-semibold text-base">{article.headline}</h5>
                  <p className="text-sm text-muted-foreground line-clamp-3">{article.summary}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-medium">{article.sourceName}</span>
                    <span>&bull;</span>
                    <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
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
