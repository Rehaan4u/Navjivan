import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Landing() {
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
            <Button 
              onClick={() => window.location.href = '/api/login'}
              data-testid="button-login"
            >
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Column - Content */}
            <div className="space-y-8 animate-fade-in">
              <Badge variant="secondary" className="text-sm font-semibold">
                <i className="fas fa-sparkles mr-2"></i>
                AI-Powered Intelligence
              </Badge>
              <div className="space-y-4">
                <h2 className="text-4xl lg:text-5xl font-bold leading-tight tracking-tight">
                  Daily Payments Industry News,
                  <span className="block text-primary mt-2">Delivered to Your Inbox</span>
                </h2>
                <p className="text-lg text-muted-foreground max-w-xl">
                  Track up to 3 payments companies and receive AI-curated summaries of industry news every morning at 9:00 AM IST. Professional intelligence for executives.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <Button 
                  size="lg" 
                  onClick={() => window.location.href = '/api/login'}
                  className="px-8"
                  data-testid="button-hero-cta"
                >
                  Start Free Today
                  <i className="fas fa-arrow-right ml-2"></i>
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                  data-testid="button-learn-more"
                >
                  Learn More
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                <i className="fas fa-check-circle text-primary mr-2"></i>
                Trusted by payments professionals worldwide
              </p>
            </div>

            {/* Right Column - Mockup */}
            <div className="relative">
              <Card className="p-6 shadow-xl">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pb-4 border-b">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <i className="fas fa-file-pdf text-primary text-lg"></i>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">Payment Chronicle</p>
                      <p className="text-sm text-muted-foreground">Daily Newsletter - Nov 4, 2025</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
                      <div className="h-3 bg-muted rounded w-full animate-pulse"></div>
                      <div className="h-3 bg-muted rounded w-5/6 animate-pulse"></div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 bg-muted rounded w-2/3 animate-pulse"></div>
                      <div className="h-3 bg-muted rounded w-full animate-pulse"></div>
                      <div className="h-3 bg-muted rounded w-4/5 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4 border-t">
                    <Badge variant="outline">Visa</Badge>
                    <Badge variant="outline">PayPal</Badge>
                    <Badge variant="outline">Stripe</Badge>
                  </div>
                </div>
              </Card>
              <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-primary/5 rounded-full blur-3xl"></div>
              <div className="absolute -top-4 -left-4 w-24 h-24 bg-chart-2/10 rounded-full blur-2xl"></div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h3 className="text-3xl lg:text-4xl font-bold mb-4">How It Works</h3>
            <p className="text-lg text-muted-foreground">
              Three simple steps to stay informed about the payments industry
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {[
              {
                step: "01",
                icon: "fa-building",
                title: "Select Companies",
                description: "Enter up to 3 payments industry companies you want to track. Examples: Visa, PayPal, Discover Financial Services.",
              },
              {
                step: "02",
                icon: "fa-robot",
                title: "AI Generates Summaries",
                description: "Every day at 9:00 AM IST, our AI scans premium sources and creates Finshots-style summaries of relevant news.",
              },
              {
                step: "03",
                icon: "fa-envelope",
                title: "Receive Newsletter",
                description: "Get a professionally formatted PDF newsletter in your inbox with concise summaries and source links.",
              },
            ].map((item, index) => (
              <Card key={index} className="p-8 hover-elevate">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="text-4xl font-bold text-primary/20">{item.step}</div>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <i className={`fas ${item.icon} text-primary text-xl`}></i>
                    </div>
                  </div>
                  <h4 className="text-xl font-semibold">{item.title}</h4>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Premium Sources */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h3 className="text-3xl lg:text-4xl font-bold">
                Powered by Premium Sources
              </h3>
              <p className="text-lg text-muted-foreground">
                We aggregate news from the most credible sources in the payments industry, ensuring you get accurate, timely, and relevant information.
              </p>
              <ul className="space-y-3">
                {[
                  "Regulatory updates and compliance news",
                  "Major business developments and M&A activity",
                  "Software launches and technology innovations",
                  "Industry events and conference insights",
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <i className="fas fa-check-circle text-primary mt-1"></i>
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                "PaymentsJournal",
                "Bloomberg",
                "CNBC",
                "Financial Times",
                "American Banker",
                "PaymentsDive",
                "The Economist",
                "Reuters",
                "The Economic Times",
              ].map((source, index) => (
                <Card 
                  key={index} 
                  className="p-4 flex items-center justify-center h-20 hover-elevate"
                >
                  <p className="text-sm font-medium text-center text-muted-foreground">
                    {source}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Showcase */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="space-y-20">
            {[
              {
                icon: "fa-brain",
                title: "AI-Powered Summarization",
                description: "Leveraging the latest OpenAI models to deliver clear, concise summaries in the engaging Finshots style.",
                features: [
                  "Engaging headlines that capture the essence",
                  "Paragraph summaries you can read in seconds",
                  "Direct links to original sources for deep dives",
                ],
                reverse: false,
              },
              {
                icon: "fa-chart-line",
                title: "Multi-Company Tracking",
                description: "Monitor up to 3 payments companies simultaneously and receive comprehensive coverage across all your interests.",
                features: [
                  "Flexible company selection with easy updates",
                  "Consolidated view of industry movements",
                  "Smart filtering to avoid duplicate news",
                ],
                reverse: true,
              },
              {
                icon: "fa-clock",
                title: "Automated Daily Delivery",
                description: "Set it and forget it. Your newsletter arrives every morning at 9:00 AM IST, perfectly timed for your coffee.",
                features: [
                  "Consistent delivery schedule",
                  "Professional PDF formatting",
                  "Email and Teams-friendly formats",
                ],
                reverse: false,
              },
            ].map((feature, index) => (
              <div 
                key={index} 
                className={`grid lg:grid-cols-2 gap-12 items-center ${feature.reverse ? 'lg:flex-row-reverse' : ''}`}
              >
                <div className={feature.reverse ? 'lg:order-2' : ''}>
                  <Card className="p-12 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                      <i className={`fas ${feature.icon} text-primary text-3xl`}></i>
                    </div>
                    <p className="text-sm font-semibold text-primary uppercase tracking-wide">
                      Feature {index + 1}
                    </p>
                  </Card>
                </div>
                <div className={`space-y-6 ${feature.reverse ? 'lg:order-1' : ''}`}>
                  <h4 className="text-2xl lg:text-3xl font-bold">{feature.title}</h4>
                  <p className="text-lg text-muted-foreground">{feature.description}</p>
                  <ul className="space-y-3">
                    {feature.features.map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <i className="fas fa-check text-primary mt-1"></i>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <Card className="p-12 lg:p-16 shadow-xl">
            <div className="space-y-6">
              <h3 className="text-3xl lg:text-4xl font-bold">
                Start Your Daily Payments Intelligence
              </h3>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Join professionals who stay ahead of the industry with automated, AI-powered news summaries delivered every morning.
              </p>
              <Button 
                size="lg" 
                onClick={() => window.location.href = '/api/login'}
                className="px-8"
                data-testid="button-final-cta"
              >
                Get Started Free
                <i className="fas fa-arrow-right ml-2"></i>
              </Button>
              <p className="text-sm text-muted-foreground pt-4">
                Newsletter delivered daily at 9:00 AM IST
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <i className="fas fa-newspaper text-xl text-primary"></i>
                <span className="font-bold">Payment Chronicle</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Daily payments industry intelligence, powered by AI.
              </p>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Product</h5>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Features</a></li>
                <li><a href="#" className="hover:text-foreground">How It Works</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Company</h5>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">About</a></li>
                <li><a href="#" className="hover:text-foreground">Contact</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Legal</h5>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2025 Payment Chronicle by Gajanan. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
