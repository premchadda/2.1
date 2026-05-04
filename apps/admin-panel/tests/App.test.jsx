import { render, screen } from '@testing-library/react';
import App from '../App';

describe('Admin Panel App', () => {
  test('renders without throwing', () => {
    render(<App />);
    expect(document.body).toBeInTheDocument();
  });

  // Add more specific tests as needed
  // Example:
  // test('displays the main heading', () => {
  //   render(<App />);
  //   const headingElement = screen.getByRole('heading', { level: 1 });
  //   expect(headingElement).toBeInTheDocument();
  // });
});