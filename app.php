<?php
use Swoole\Http\Request;
use Swoole\Http\Response;
use Swoole\WebSocket\Frame;
use Swoole\WebSocket\Server;

// Simulated database connection to MongoDB
$mongoClient = new MongoDB\Client("mongodb://localhost:27017");
$usersCollection = $mongoClient->selectDatabase('service_request')->selectCollection('users');
$providersCollection = $mongoClient->selectDatabase('service_request')->selectCollection('providers');

// Include JWT library
require_once 'vendor/autoload.php';
use \Firebase\JWT\JWT;

// JWT secret key
$secret_key = 'your_secret_key';

$httpServer = new Swoole\Http\Server("0.0.0.0", 9501);
$wsServer = new Server("0.0.0.0", 9502);

// API endpoints
$httpServer->on('request', function (Request $request, Response $response) use ($mongoClient, $usersCollection, $providersCollection, $secret_key) {
    $response->header("Content-Type", "application/json");

    if ($request->server['request_uri'] === '/api/login' && $request->server['request_method'] === 'POST') {
        $data = json_decode($request->rawContent(), true);

        $user = $usersCollection->findOne(['phone' => $data['phone'], 'password' => $data['password']);

        if ($user) {
            $token = JWT::encode(['phone' => $data['phone']], $secret_key, 'HS256');
            $response->end(json_encode(['auth_token' => $token]));
            return;
        } else {
            $response->status(401);
            $response->end(json_encode(['error' => 'Invalid credentials']));
            return;
        }
    }

    if ($request->server['request_uri'] === '/api/provider/location/update' && $request->server['request_method'] === 'POST') {
        $data = json_decode($request->rawContent(), true);

        $jwt_token = $request->header['authorization'];
        $decoded = JWT::decode($jwt_token, $secret_key, ['HS256']);

        $provider_phone = $decoded->phone;

        $providersCollection->updateOne(
            ['phone' => $provider_phone],
            ['$set' => ['lat' => $data['lat'], 'lng' => $data['lng'], 'is_online' => $data['is_online']]
        );

        $response->end(json_encode(['message' => 'Location and online status updated successfully']));
        return;
    }

    if ($request->server['request_uri'] === '/api/providers/nearby' && $request->server['request_method'] === 'GET') {
        $lat = $request->get['lat'];
        $lng = $request->get['lng'];

        $nearby_providers = $providersCollection->find([
            'lat' => ['$gte' => $lat - 0.01, '$lte' => $lat + 0.01],
            'lng' => ['$gte' => $lng - 0.01, '$lte' => $lng + 0.01],
            'is_online' => true
        ]);

        $response->end(json_encode(['status' => 'success', 'providers' => $nearby_providers->toArray()]));
        return;
    }

    $response->status(404);
    $response->end(json_encode(['error' => 'Invalid API endpoint']));
});

// WebSocket server
$wsServer->on('message', function (Server $server, Frame $frame) use ($wsServer, $providersCollection) {
    foreach ($server->connections as $fd) {
        $server->push($fd, $frame->data);
    }

    // Handle real-time notifications to all providers
    $providers = $providersCollection->find();
    foreach ($providers as $provider) {
        $server->push($provider['fd'], $frame->data);
    }
});

$httpServer->start();
$wsServer->start();
