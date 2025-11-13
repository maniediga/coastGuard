import json
import pika
from app.config import Config
from urllib.parse import urlparse
import time

class RabbitPublisher:
    def __init__(self, rabbit_url=None, queue_name=None):
        self.rabbit_url = rabbit_url or Config.RABBITMQ_URL
        self.queue_name = queue_name or Config.RABBITMQ_QUEUE
        params = pika.URLParameters(self.rabbit_url)
        self._connect(params)

    def _connect(self, params):
        self.conn = pika.BlockingConnection(params)
        self.ch = self.conn.channel()
        self.ch.queue_declare(queue=self.queue_name, durable=True)

    def publish_post(self, post: dict):
        payload = dict(post)
        payload["post_type"] = "social-media-post"
        body = json.dumps(payload, default=str).encode("utf-8")
        self.ch.basic_publish(
            exchange="",
            routing_key=self.queue_name,
            body=body,
            properties=pika.BasicProperties(delivery_mode=2)  # persistent message
        )

    def close(self):
        try:
            self.conn.close()
        except Exception:
            pass
