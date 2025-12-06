'use client';

import { Github, Youtube, Mail, Phone, User } from 'lucide-react';
import Link from 'next/link';

/**
 * Footer Component - Displays social links and contact information
 */
export function Footer() {
  return (
    <footer className="border-t bg-background mt-auto">
      <div className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Social Links */}
          <div>
            <h3 className="text-sm font-semibold mb-4 text-foreground">Connect With Us</h3>
            <div className="flex flex-col gap-3">
              <Link
                href="https://github.com/fourtytwo42/healthChains"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors group"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-md bg-muted group-hover:bg-muted/80 transition-colors">
                  <Github className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium">GitHub</span>
              </Link>
              <Link
                href="https://www.youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors group"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-md bg-muted group-hover:bg-muted/80 transition-colors">
                  <Youtube className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium">YouTube</span>
              </Link>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-sm font-semibold mb-4 text-foreground">Contact</h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="flex items-center justify-center w-10 h-10 rounded-md bg-muted">
                  <User className="h-5 w-5" />
                </div>
                <span className="text-sm">Eric Henderson</span>
              </div>
              <a
                href="tel:+12178482206"
                className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors group"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-md bg-muted group-hover:bg-muted/80 transition-colors">
                  <Phone className="h-5 w-5" />
                </div>
                <span className="text-sm">(217) 848-2206</span>
              </a>
              <a
                href="mailto:henderson.1983@gmail.com"
                className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors group"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-md bg-muted group-hover:bg-muted/80 transition-colors">
                  <Mail className="h-5 w-5" />
                </div>
                <span className="text-sm">henderson.1983@gmail.com</span>
              </a>
            </div>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} HealthChains. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

