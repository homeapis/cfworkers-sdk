interface D1Ticket {
    ticket_id: string;
    customer_email: string;
    created_at: Number;
    updated_at: Number | null;
    is_closed: Number;
    closed_on: Number | null;
    closed_by: string | null;
    initial_subject: string;
}

interface D1TicketMessage {
    is_email: Number;
    ticket_id: string;
    message_id: string;
    message_text: string | null;
    created_at: Number;
    is_support: Number;
    sender_email: string;
    message_subject: string;
    is_html: Number | null;
}