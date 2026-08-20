import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// ---------- Mocks (must use vi.hoisted for values referenced in vi.mock) ----------

const { mk } = vi.hoisted(() => {
  const mk = (tag: string) => {
    const Comp = (props: any) => React.createElement(tag, props, props.children);
    Comp.displayName = tag;
    return Comp;
  };
  return { mk };
});

vi.mock("@radix-ui/react-slot", () => ({
  Slot: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

vi.mock("lucide-react", () => ({
  CheckIcon: (props: any) => <svg data-testid="check-icon" {...props} />,
  ChevronDownIcon: (props: any) => <svg data-testid="chevron-down-icon" {...props} />,
  ChevronUpIcon: (props: any) => <svg data-testid="chevron-up-icon" {...props} />,
  ChevronRightIcon: (props: any) => <svg data-testid="chevron-right-icon" {...props} />,
  CircleIcon: (props: any) => <svg data-testid="circle-icon" {...props} />,
  XIcon: (props: any) => <svg data-testid="x-icon" {...props} />,
}));

vi.mock("@radix-ui/react-switch", () => {
  const Root = (props: any) => {
    const { checked, defaultChecked, ...rest } = props;
    const isChecked = checked !== undefined ? checked : !!defaultChecked;
    return React.createElement("button", { ...rest, "data-state": isChecked ? "checked" : "unchecked" });
  };
  Root.displayName = "SwitchRoot";
  return { Root, Thumb: mk("span") };
});

vi.mock("@radix-ui/react-tabs", () => ({
  Root: mk("div"),
  List: mk("div"),
  Trigger: mk("button"),
  Content: mk("div"),
}));

vi.mock("@radix-ui/react-select", () => ({
  Root: mk("div"),
  Group: mk("div"),
  Value: ({ placeholder, children, ...props }: any) => <span {...props}>{children || placeholder}</span>,
  Trigger: mk("button"),
  Icon: mk("span"),
  Portal: ({ children }: any) => children,
  Content: mk("div"),
  Viewport: mk("div"),
  Item: mk("div"),
  ItemText: mk("span"),
  ItemIndicator: mk("span"),
  Separator: mk("div"),
  Label: mk("div"),
  ScrollUpButton: mk("div"),
  ScrollDownButton: mk("div"),
}));

vi.mock("@radix-ui/react-dropdown-menu", () => ({
  Root: mk("div"),
  Portal: ({ children }: any) => children,
  Trigger: mk("button"),
  Content: mk("div"),
  Group: mk("div"),
  Label: mk("div"),
  Item: mk("div"),
  CheckboxItem: mk("div"),
  RadioGroup: mk("div"),
  RadioItem: mk("div"),
  Separator: mk("div"),
  Sub: mk("div"),
  SubTrigger: mk("button"),
  SubContent: mk("div"),
}));

vi.mock("@radix-ui/react-dialog", () => ({
  Root: mk("div"),
  Portal: ({ children }: any) => children,
  Trigger: mk("button"),
  Close: mk("button"),
  Overlay: mk("div"),
  Content: mk("div"),
  Header: mk("div"),
  Footer: mk("div"),
  Title: mk("h2"),
  Description: mk("p"),
}));

vi.mock("@radix-ui/react-tooltip", () => ({
  Provider: mk("div"),
  Root: mk("div"),
  Trigger: mk("button"),
  Content: mk("div"),
  Portal: ({ children }: any) => children,
  Arrow: mk("div"),
}));

// ---------- Imports (after mocks) ----------

import { Button } from "../button";
import { Badge } from "../badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../card";
import { Input } from "../input";
import { Textarea } from "../textarea";
import { Switch } from "../switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../tabs";
import { Tooltip, TooltipTrigger, TooltipContent } from "../tooltip";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../dropdown-menu";

// =====================================================
// Button
// =====================================================
describe("Button", () => {
  it("renders with default props", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("renders with custom className", () => {
    render(<Button className="extra-class">Btn</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("extra-class");
  });

  const variants = ["default", "destructive", "outline", "secondary", "ghost", "link"] as const;
  variants.forEach((v) => {
    it(`renders variant "${v}"`, () => {
      render(<Button variant={v}>Btn</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  const sizes = ["default", "sm", "lg", "icon"] as const;
  sizes.forEach((s) => {
    it(`renders size "${s}"`, () => {
      render(<Button size={s}>Btn</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  it("renders as child via Slot", () => {
    render(
      <Button asChild>
        <a href="/link">Link Button</a>
      </Button>,
    );
    expect(screen.getByText("Link Button")).toBeInTheDocument();
  });

  it("applies disabled attribute", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

// =====================================================
// Badge
// =====================================================
describe("Badge", () => {
  it("renders with default props", () => {
    render(<Badge>Tag</Badge>);
    expect(screen.getByText("Tag")).toBeInTheDocument();
  });

  it("renders with custom className", () => {
    render(<Badge className="my-badge">Tag</Badge>);
    const el = screen.getByText("Tag");
    expect(el).toHaveClass("my-badge");
  });

  const variants = ["default", "secondary", "destructive", "outline"] as const;
  variants.forEach((v) => {
    it(`renders variant "${v}"`, () => {
      render(<Badge variant={v}>Tag</Badge>);
      expect(screen.getByText("Tag")).toBeInTheDocument();
    });
  });
});

// =====================================================
// Card
// =====================================================
describe("Card", () => {
  it("renders Card", () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.querySelector('[data-slot="card"]')).toBeInTheDocument();
  });

  it("renders CardHeader", () => {
    render(<CardHeader>Header</CardHeader>);
    expect(screen.getByText("Header")).toBeInTheDocument();
  });

  it("renders CardTitle", () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByText("Title")).toBeInTheDocument();
  });

  it("renders CardDescription", () => {
    render(<CardDescription>Desc</CardDescription>);
    expect(screen.getByText("Desc")).toBeInTheDocument();
  });

  it("renders CardContent", () => {
    render(<CardContent>Body</CardContent>);
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("renders CardFooter", () => {
    render(<CardFooter>Footer</CardFooter>);
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });

  it("renders a full Card composition", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>My Title</CardTitle>
          <CardDescription>My Desc</CardDescription>
        </CardHeader>
        <CardContent>Body text</CardContent>
        <CardFooter>Footer text</CardFooter>
      </Card>,
    );
    expect(screen.getByText("My Title")).toBeInTheDocument();
    expect(screen.getByText("My Desc")).toBeInTheDocument();
    expect(screen.getByText("Body text")).toBeInTheDocument();
    expect(screen.getByText("Footer text")).toBeInTheDocument();
  });

  it("applies custom className to Card", () => {
    const { container } = render(<Card className="custom-card">X</Card>);
    expect(container.querySelector('[data-slot="card"]')).toHaveClass("custom-card");
  });
});

// =====================================================
// Input
// =====================================================
describe("Input", () => {
  it("renders with default props", () => {
    render(<Input />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders with custom className", () => {
    render(<Input className="my-input" />);
    expect(screen.getByRole("textbox")).toHaveClass("my-input");
  });

  it("renders with type and placeholder", () => {
    render(<Input type="email" placeholder="Enter email" />);
    const input = screen.getByPlaceholderText("Enter email");
    expect(input).toHaveAttribute("type", "email");
  });

  it("shows value", () => {
    render(<Input defaultValue="hello" />);
    expect(screen.getByRole("textbox")).toHaveValue("hello");
  });

  it("renders disabled", () => {
    render(<Input disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});

// =====================================================
// Textarea
// =====================================================
describe("Textarea", () => {
  it("renders with default props", () => {
    render(<Textarea />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders with custom className", () => {
    render(<Textarea className="my-ta" />);
    expect(screen.getByRole("textbox")).toHaveClass("my-ta");
  });

  it("renders with placeholder", () => {
    render(<Textarea placeholder="Write here" />);
    expect(screen.getByPlaceholderText("Write here")).toBeInTheDocument();
  });

  it("renders disabled", () => {
    render(<Textarea disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});

// =====================================================
// Switch
// =====================================================
describe("Switch", () => {
  it("renders with default props", () => {
    render(<Switch />);
    // Switch root is a button in our mock
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders with custom className", () => {
    render(<Switch className="my-switch" />);
    expect(screen.getByRole("button")).toHaveClass("my-switch");
  });

  it("renders with checked state", () => {
    render(<Switch checked={true} />);
    expect(screen.getByRole("button")).toHaveAttribute("data-state", "checked");
  });

  it("renders with unchecked state", () => {
    render(<Switch checked={false} />);
    expect(screen.getByRole("button")).toHaveAttribute("data-state", "unchecked");
  });

  it("renders disabled", () => {
    render(<Switch disabled />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

// =====================================================
// Tabs
// =====================================================
describe("Tabs", () => {
  it("renders TabsList, TabsTrigger, TabsContent without crashing", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText("Tab 1")).toBeInTheDocument();
    expect(screen.getByText("Tab 2")).toBeInTheDocument();
    expect(screen.getByText("Content 1")).toBeInTheDocument();
    expect(screen.getByText("Content 2")).toBeInTheDocument();
  });

  it("renders with custom className on Tabs", () => {
    const { container } = render(
      <Tabs defaultValue="t" className="custom-tabs">
        <TabsList>
          <TabsTrigger value="t">T</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    expect(container.querySelector('[data-slot="tabs"]')).toHaveClass("custom-tabs");
  });

  it("renders TabsTrigger with data-slot", () => {
    render(
      <Tabs defaultValue="t">
        <TabsList>
          <TabsTrigger value="t">T</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    expect(screen.getByText("T")).toHaveAttribute("data-slot", "tabs-trigger");
  });
});

// =====================================================
// Tooltip
// =====================================================
describe("Tooltip", () => {
  it("renders Tooltip with trigger and content without crashing", () => {
    render(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Tooltip text</TooltipContent>
      </Tooltip>,
    );
    expect(screen.getByText("Hover me")).toBeInTheDocument();
    // TooltipContent is portaled, but our mock renders children inline
    expect(screen.getByText("Tooltip text")).toBeInTheDocument();
  });

  it("renders trigger text", () => {
    render(
      <Tooltip>
        <TooltipTrigger>Trigger</TooltipTrigger>
        <TooltipContent>Tip</TooltipContent>
      </Tooltip>,
    );
    expect(screen.getByRole("button", { name: "Trigger" })).toBeInTheDocument();
  });
});

// =====================================================
// Select
// =====================================================
describe("Select", () => {
  it("renders Select with trigger text without crashing", () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b">Option B</SelectItem>
        </SelectContent>
      </Select>,
    );
    // The trigger renders the placeholder
    expect(screen.getByText("Pick one")).toBeInTheDocument();
  });

  it("renders select items", () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Item A</SelectItem>
          <SelectItem value="b">Item B</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByText("Item A")).toBeInTheDocument();
    expect(screen.getByText("Item B")).toBeInTheDocument();
  });
});

// =====================================================
// Dialog
// =====================================================
describe("Dialog", () => {
  it("renders Dialog with trigger text without crashing", () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>Description</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
    // Our mock renders everything inline (no portal)
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
  });

  it("renders DialogContent with data-slot", () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByText("Test")).toBeInTheDocument();
  });
});

// =====================================================
// DropdownMenu
// =====================================================
describe("DropdownMenu", () => {
  it("renders DropdownMenu with trigger text without crashing", () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
          <DropdownMenuItem>Item 2</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
    // Our mock renders everything inline
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
  });
});
